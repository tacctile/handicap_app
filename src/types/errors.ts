/**
 * Custom Error Types for Furlong Application
 *
 * Provides specific error classes for different failure scenarios:
 * - DRFParseError: Issues during DRF file parsing
 * - ValidationError: Data validation failures
 * - FileFormatError: File format/encoding issues
 */

/**
 * Base error class for all application errors
 * Extends Error with additional context fields
 */
export abstract class AppError extends Error {
  /** Error code for categorization */
  abstract readonly code: string

  /** Human-readable error category */
  abstract readonly category: string

  /** Whether this error is recoverable */
  readonly recoverable: boolean

  /** Additional context for debugging/logging */
  readonly context: Record<string, unknown>

  /** Timestamp when error occurred */
  readonly timestamp: string

  constructor(
    message: string,
    options: {
      recoverable?: boolean
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message, { cause: options.cause })
    this.name = this.constructor.name
    this.recoverable = options.recoverable ?? true
    this.context = options.context ?? {}
    this.timestamp = new Date().toISOString()

    // Maintain proper stack trace in V8 engines
    const ErrorWithStackTrace = Error as typeof Error & {
      captureStackTrace?: (target: object, constructor: (...args: unknown[]) => unknown) => void
    }
    if (typeof ErrorWithStackTrace.captureStackTrace === 'function') {
      ErrorWithStackTrace.captureStackTrace(this, this.constructor as (...args: unknown[]) => unknown)
    }
  }

  /**
   * Convert error to a JSON-serializable object for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      recoverable: this.recoverable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.message
  }

  /**
   * Get suggestion for resolving the error
   */
  getSuggestion(): string {
    return 'Please try again or contact support if the problem persists.'
  }
}

// ============================================================================
// DRF PARSE ERROR
// ============================================================================

/**
 * Error codes for DRF parsing failures
 */
export type DRFParseErrorCode =
  | 'EMPTY_FILE'
  | 'INVALID_FORMAT'
  | 'MISSING_FIELDS'
  | 'TRUNCATED_LINE'
  | 'ENCODING_ERROR'
  | 'PARSE_EXCEPTION'
  | 'FIELD_COUNT_MISMATCH'
  | 'INVALID_CSV'

/**
 * Error thrown during DRF file parsing
 */
export class DRFParseError extends AppError {
  readonly code: DRFParseErrorCode
  readonly category = 'DRF Parsing'

  /** Line number where error occurred (1-indexed) */
  readonly lineNumber?: number

  /** The problematic content (truncated for safety) */
  readonly problematicContent?: string

  /** Expected field count */
  readonly expectedFields?: number

  /** Actual field count */
  readonly actualFields?: number

  constructor(
    code: DRFParseErrorCode,
    message: string,
    options: {
      lineNumber?: number
      problematicContent?: string
      expectedFields?: number
      actualFields?: number
      recoverable?: boolean
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message, {
      recoverable: options.recoverable ?? true,
      context: {
        ...options.context,
        lineNumber: options.lineNumber,
        expectedFields: options.expectedFields,
        actualFields: options.actualFields,
      },
      cause: options.cause,
    })

    this.code = code
    this.lineNumber = options.lineNumber

    // Truncate problematic content for safety (avoid logging huge strings)
    if (options.problematicContent) {
      this.problematicContent =
        options.problematicContent.length > 200
          ? options.problematicContent.substring(0, 200) + '...'
          : options.problematicContent
    }

    this.expectedFields = options.expectedFields
    this.actualFields = options.actualFields
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'EMPTY_FILE':
        return 'The file appears to be empty.'
      case 'INVALID_FORMAT':
        return 'This file is not in a recognized DRF format.'
      case 'MISSING_FIELDS':
        return 'The file is missing required data fields.'
      case 'TRUNCATED_LINE':
        return `The file contains incomplete data${this.lineNumber ? ` at line ${this.lineNumber}` : ''}.`
      case 'ENCODING_ERROR':
        return 'The file contains invalid characters or encoding issues.'
      case 'FIELD_COUNT_MISMATCH':
        return `Data format inconsistency detected${this.lineNumber ? ` at line ${this.lineNumber}` : ''}.`
      case 'INVALID_CSV':
        return 'The file is not valid CSV format.'
      default:
        return this.message
    }
  }

  getSuggestion(): string {
    switch (this.code) {
      case 'EMPTY_FILE':
        return 'Please select a valid DRF file with race data.'
      case 'INVALID_FORMAT':
        return 'Make sure you are uploading a .drf file from Daily Racing Form.'
      case 'MISSING_FIELDS':
        return 'Try downloading the DRF file again.'
      case 'TRUNCATED_LINE':
        return 'The file may have been corrupted during download. Try downloading again.'
      case 'ENCODING_ERROR':
        return 'Ensure the file was downloaded completely and try again.'
      case 'FIELD_COUNT_MISMATCH':
        return 'Some data may be incomplete. The file might be from an unsupported DRF format version.'
      case 'INVALID_CSV':
        return 'Make sure the file is a valid DRF file in CSV format.'
      default:
        return 'Please try again or contact support.'
    }
  }
}

// ============================================================================
// VALIDATION ERROR
// ============================================================================

/**
 * Error codes for validation failures
 */
export type ValidationErrorCode =
  | 'NO_RACES'
  | 'INSUFFICIENT_HORSES'
  | 'MISSING_CRITICAL_DATA'
  | 'INVALID_RACE_DATA'
  | 'INVALID_HORSE_DATA'
  | 'DATA_CONSISTENCY'
  | 'VALIDATION_FAILED'

/**
 * Error thrown during data validation
 */
export class ValidationError extends AppError {
  readonly code: ValidationErrorCode
  readonly category = 'Validation'

  /** Race number where error occurred */
  readonly raceNumber?: number

  /** Horse name/number related to error */
  readonly horseIdentifier?: string

  /** Field that failed validation */
  readonly field?: string

  /** Expected value or format */
  readonly expected?: string

  /** Actual value received */
  readonly actual?: string

  constructor(
    code: ValidationErrorCode,
    message: string,
    options: {
      raceNumber?: number
      horseIdentifier?: string
      field?: string
      expected?: string
      actual?: string
      recoverable?: boolean
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message, {
      recoverable: options.recoverable ?? true,
      context: {
        ...options.context,
        raceNumber: options.raceNumber,
        horseIdentifier: options.horseIdentifier,
        field: options.field,
        expected: options.expected,
        actual: options.actual,
      },
      cause: options.cause,
    })

    this.code = code
    this.raceNumber = options.raceNumber
    this.horseIdentifier = options.horseIdentifier
    this.field = options.field
    this.expected = options.expected
    this.actual = options.actual
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'NO_RACES':
        return 'No race data found in the file.'
      case 'INSUFFICIENT_HORSES':
        return `Race ${this.raceNumber || '?'} has fewer than 2 horses.`
      case 'MISSING_CRITICAL_DATA':
        return `Missing required data${this.field ? ` for ${this.field}` : ''}.`
      case 'INVALID_RACE_DATA':
        return `Race ${this.raceNumber || '?'} contains invalid data.`
      case 'INVALID_HORSE_DATA':
        return `${this.horseIdentifier || 'A horse'} has invalid data${this.field ? ` in ${this.field}` : ''}.`
      case 'DATA_CONSISTENCY':
        return 'Data consistency issue detected.'
      default:
        return this.message
    }
  }

  getSuggestion(): string {
    switch (this.code) {
      case 'NO_RACES':
        return 'Make sure the file contains race entries.'
      case 'INSUFFICIENT_HORSES':
        return 'At least 2 horses are required for analysis. Check for scratches.'
      case 'MISSING_CRITICAL_DATA':
        return 'Some required information is missing. Analysis may be limited.'
      case 'INVALID_RACE_DATA':
      case 'INVALID_HORSE_DATA':
        return 'Try downloading a fresh copy of the DRF file.'
      case 'DATA_CONSISTENCY':
        return 'Some calculations may be affected. Review the data manually.'
      default:
        return 'Please verify the file and try again.'
    }
  }
}

// ============================================================================
// FILE FORMAT ERROR
// ============================================================================

/**
 * Error codes for file format issues
 */
export type FileFormatErrorCode =
  | 'NOT_TEXT_FILE'
  | 'BINARY_CONTENT'
  | 'UNSUPPORTED_ENCODING'
  | 'FILE_TOO_LARGE'
  | 'FILE_TOO_SMALL'
  | 'WRONG_EXTENSION'
  | 'READ_ERROR'

/**
 * Error thrown for file format/encoding issues
 */
export class FileFormatError extends AppError {
  readonly code: FileFormatErrorCode
  readonly category = 'File Format'

  /** The filename that caused the error */
  readonly filename?: string

  /** Detected file type/MIME type */
  readonly detectedType?: string

  /** File size in bytes */
  readonly fileSize?: number

  constructor(
    code: FileFormatErrorCode,
    message: string,
    options: {
      filename?: string
      detectedType?: string
      fileSize?: number
      recoverable?: boolean
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message, {
      recoverable: options.recoverable ?? true,
      context: {
        ...options.context,
        filename: options.filename,
        detectedType: options.detectedType,
        fileSize: options.fileSize,
      },
      cause: options.cause,
    })

    this.code = code
    this.filename = options.filename
    this.detectedType = options.detectedType
    this.fileSize = options.fileSize
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'NOT_TEXT_FILE':
        return 'The file is not a text file.'
      case 'BINARY_CONTENT':
        return 'The file appears to contain binary data, not DRF data.'
      case 'UNSUPPORTED_ENCODING':
        return 'The file has an unsupported character encoding.'
      case 'FILE_TOO_LARGE':
        return 'The file is too large to process.'
      case 'FILE_TOO_SMALL':
        return 'The file appears to be empty or too small.'
      case 'WRONG_EXTENSION':
        return `Expected a .drf file${this.filename ? `, got ${this.filename}` : ''}.`
      case 'READ_ERROR':
        return 'Unable to read the file.'
      default:
        return this.message
    }
  }

  getSuggestion(): string {
    switch (this.code) {
      case 'NOT_TEXT_FILE':
      case 'BINARY_CONTENT':
        return 'Please upload a valid DRF file in CSV/text format.'
      case 'UNSUPPORTED_ENCODING':
        return 'The file should be in ASCII or UTF-8 encoding.'
      case 'FILE_TOO_LARGE':
        return 'Try processing fewer races or splitting the file.'
      case 'FILE_TOO_SMALL':
        return 'Make sure the file downloaded completely.'
      case 'WRONG_EXTENSION':
        return 'Upload a file with .drf extension from Daily Racing Form.'
      case 'READ_ERROR':
        return 'Make sure the file is not open in another program.'
      default:
        return 'Please try again with a valid DRF file.'
    }
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Type guard for DRFParseError
 */
export function isDRFParseError(error: unknown): error is DRFParseError {
  return error instanceof DRFParseError
}

/**
 * Type guard for ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Type guard for FileFormatError
 */
export function isFileFormatError(error: unknown): error is FileFormatError {
  return error instanceof FileFormatError
}

/**
 * Normalize any error to an AppError or extract useful information
 */
export function normalizeError(error: unknown): {
  message: string
  name: string
  stack?: string
  context: Record<string, unknown>
} {
  if (isAppError(error)) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      context: error.context,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      context: {},
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
      name: 'Error',
      context: {},
    }
  }

  return {
    message: 'An unknown error occurred',
    name: 'UnknownError',
    context: { rawError: String(error) },
  }
}

/**
 * Get user-friendly message from any error
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.getUserMessage()
  }

  if (error instanceof Error) {
    // Check for common error patterns
    const msg = error.message.toLowerCase()
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'A network error occurred. Please check your connection.'
    }
    if (msg.includes('timeout')) {
      return 'The operation timed out. Please try again.'
    }
    if (msg.includes('permission') || msg.includes('access')) {
      return 'Permission denied. Please check file access.'
    }
    return error.message
  }

  return 'An unexpected error occurred.'
}

/**
 * Get suggestion from any error
 */
export function getErrorSuggestion(error: unknown): string {
  if (isAppError(error)) {
    return error.getSuggestion()
  }

  return 'Please try again or contact support if the problem persists.'
}
