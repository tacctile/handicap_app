/**
 * Input Sanitization & Validation Utilities
 *
 * Security utilities for sanitizing user inputs and validating files.
 * Prevents XSS, injection attacks, and malicious file uploads.
 *
 * Usage:
 * - sanitizeString: Clean any user text input
 * - sanitizeEmail: Clean and validate email format
 * - validateFileType: Check file MIME type against allowed list
 * - validateFileSize: Check file doesn't exceed size limit
 */

// ============================================================================
// STRING SANITIZATION
// ============================================================================

/**
 * HTML entities to escape for XSS prevention
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

/**
 * Sanitize a string by escaping HTML entities and removing dangerous content.
 * Use this for any user-provided text before storage or display.
 *
 * @param input - Raw user input string
 * @returns Sanitized string safe for storage and display
 *
 * @example
 * sanitizeString('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Trim whitespace
  let sanitized = input.trim()

  // Remove null bytes (can cause issues in some systems)
  sanitized = sanitized.replace(/\0/g, '')

  // Escape HTML entities
  sanitized = sanitized.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)

  // Remove any remaining control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return sanitized
}

/**
 * Sanitize string but preserve some formatting (newlines, basic structure).
 * Use for multi-line text inputs like comments or notes.
 *
 * @param input - Raw user input string
 * @returns Sanitized string with preserved formatting
 */
export function sanitizeMultilineString(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Split by newlines, sanitize each line, rejoin
  return input
    .split('\n')
    .map((line) => sanitizeString(line))
    .join('\n')
}

// ============================================================================
// EMAIL SANITIZATION & VALIDATION
// ============================================================================

/**
 * Email validation regex (RFC 5322 simplified)
 * Matches most valid email formats while rejecting obvious invalids
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/**
 * Maximum email length per RFC 5321
 */
const MAX_EMAIL_LENGTH = 254

/**
 * Sanitize and validate an email address.
 * Returns empty string if email is invalid.
 *
 * @param input - Raw email input
 * @returns Sanitized lowercase email or empty string if invalid
 *
 * @example
 * sanitizeEmail('  USER@EXAMPLE.COM  ')
 * // Returns: 'user@example.com'
 *
 * sanitizeEmail('not-an-email')
 * // Returns: ''
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Trim and lowercase
  const email = input.trim().toLowerCase()

  // Check length
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
    return ''
  }

  // Validate format
  if (!EMAIL_REGEX.test(email)) {
    return ''
  }

  // Additional checks for obviously invalid emails
  if (email.startsWith('.') || email.endsWith('.')) {
    return ''
  }

  if (email.includes('..')) {
    return ''
  }

  return email
}

/**
 * Check if an email is valid without sanitizing
 *
 * @param email - Email to validate
 * @returns true if email is valid
 */
export function isValidEmail(email: string): boolean {
  return sanitizeEmail(email) !== ''
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Common allowed MIME types for DRF files and documents
 */
export const ALLOWED_DRF_TYPES = [
  'text/plain',
  'text/csv',
  'application/octet-stream', // Generic binary, DRF files often have this
] as const

/**
 * Common allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

/**
 * Default maximum file size: 10MB
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Validate that a file's MIME type is in the allowed list.
 * Also performs basic filename extension validation.
 *
 * @param file - File object to validate
 * @param allowedTypes - Array of allowed MIME type strings
 * @returns true if file type is allowed
 *
 * @example
 * validateFileType(file, ['text/plain', 'text/csv'])
 * // Returns: true if file is plain text or CSV
 */
export function validateFileType(file: File, allowedTypes: readonly string[]): boolean {
  if (!(file instanceof File)) {
    return false
  }

  // Check MIME type
  const mimeType = file.type.toLowerCase()

  // Empty MIME type check - browser couldn't determine type
  // For DRF files, we may need to allow this and check extension
  if (!mimeType && allowedTypes.includes('application/octet-stream')) {
    // Check file extension for DRF files
    const extension = getFileExtension(file.name)
    return ['drf', 'txt', 'csv'].includes(extension)
  }

  return allowedTypes.some((allowed) => mimeType === allowed.toLowerCase())
}

/**
 * Validate that a file doesn't exceed the maximum size.
 *
 * @param file - File object to validate
 * @param maxBytes - Maximum allowed file size in bytes
 * @returns true if file size is within limit
 *
 * @example
 * validateFileSize(file, 5 * 1024 * 1024) // 5MB limit
 * // Returns: true if file is <= 5MB
 */
export function validateFileSize(file: File, maxBytes: number): boolean {
  if (!(file instanceof File)) {
    return false
  }

  if (typeof maxBytes !== 'number' || maxBytes <= 0) {
    return false
  }

  return file.size <= maxBytes
}

/**
 * Get file extension from filename (lowercase, without dot)
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return ''
  }
  return filename.substring(lastDot + 1).toLowerCase()
}

/**
 * Validate filename for dangerous characters.
 * Prevents path traversal and special character injection.
 *
 * @param filename - Filename to validate
 * @returns true if filename is safe
 */
export function validateFilename(filename: string): boolean {
  if (typeof filename !== 'string' || filename.length === 0) {
    return false
  }

  // Max filename length
  if (filename.length > 255) {
    return false
  }

  // No path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false
  }

  // No null bytes
  if (filename.includes('\0')) {
    return false
  }

  // No control characters
  if (/[\x00-\x1F\x7F]/.test(filename)) {
    return false
  }

  // No reserved Windows names
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
  if (reserved.test(filename)) {
    return false
  }

  return true
}

// ============================================================================
// NUMBER VALIDATION
// ============================================================================

/**
 * Validate and parse a numeric input.
 * Returns the number or default value if invalid.
 *
 * @param input - Input to validate (string or number)
 * @param defaultValue - Default value if input is invalid
 * @param options - Optional min/max bounds
 * @returns Validated number or default value
 */
export function validateNumber(
  input: unknown,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number {
  let num: number

  if (typeof input === 'number') {
    num = input
  } else if (typeof input === 'string') {
    num = parseFloat(input)
  } else {
    return defaultValue
  }

  if (!Number.isFinite(num)) {
    return defaultValue
  }

  if (options?.min !== undefined && num < options.min) {
    return options.min
  }

  if (options?.max !== undefined && num > options.max) {
    return options.max
  }

  return num
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Validate a URL is safe (no javascript:, data:, etc.)
 *
 * @param url - URL string to validate
 * @param allowedProtocols - Allowed URL protocols (default: https, http)
 * @returns true if URL is safe
 */
export function validateUrl(
  url: string,
  allowedProtocols: string[] = ['https:', 'http:']
): boolean {
  if (typeof url !== 'string' || url.length === 0) {
    return false
  }

  try {
    const parsed = new URL(url)
    return allowedProtocols.includes(parsed.protocol)
  } catch {
    return false
  }
}

// ============================================================================
// COMPREHENSIVE FILE VALIDATION
// ============================================================================

/**
 * Result of comprehensive file validation
 */
export interface FileValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Options for file validation
 */
export interface FileValidationOptions {
  allowedTypes: readonly string[]
  maxBytes: number
  allowEmptyFile?: boolean
}

/**
 * Perform comprehensive file validation.
 * Checks type, size, filename, and other security concerns.
 *
 * @param file - File to validate
 * @param options - Validation options
 * @returns Validation result with any error messages
 */
export function validateFile(file: File, options: FileValidationOptions): FileValidationResult {
  const errors: string[] = []

  // Check if it's actually a File object
  if (!(file instanceof File)) {
    return { valid: false, errors: ['Invalid file object'] }
  }

  // Validate filename
  if (!validateFilename(file.name)) {
    errors.push('Invalid filename')
  }

  // Validate file type
  if (!validateFileType(file, options.allowedTypes)) {
    errors.push(`File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`)
  }

  // Validate file size
  if (!validateFileSize(file, options.maxBytes)) {
    const maxMB = (options.maxBytes / (1024 * 1024)).toFixed(1)
    errors.push(`File too large. Maximum size: ${maxMB}MB`)
  }

  // Check for empty files (unless allowed)
  if (!options.allowEmptyFile && file.size === 0) {
    errors.push('File is empty')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
