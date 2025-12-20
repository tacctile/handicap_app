/**
 * DRF Parser Web Worker
 *
 * Handles DRF file parsing in a background thread to keep UI responsive.
 * Sends progress updates during parsing for loading indicator display.
 */

import { parseDRFFile } from './drfParser'
import type {
  DRFWorkerRequest,
  DRFWorkerResponse,
  DRFWorkerProgressMessage,
  DRFWorkerSuccessResponse,
  DRFWorkerErrorResponse,
  ParsingErrorCode,
} from '../types/drf'

/**
 * Map of error types to error codes
 */
function getErrorCode(error: Error): ParsingErrorCode {
  const message = error.message.toLowerCase()

  if (message.includes('empty')) return 'EMPTY_FILE'
  if (message.includes('invalid')) return 'INVALID_FILE'
  if (message.includes('corrupt')) return 'CORRUPTED_DATA'
  if (message.includes('format')) return 'UNSUPPORTED_FORMAT'
  if (message.includes('required') || message.includes('missing')) return 'MISSING_REQUIRED_FIELD'
  if (message.includes('value')) return 'INVALID_FIELD_VALUE'

  return 'PARSE_EXCEPTION'
}

/**
 * Get suggestion for common errors
 */
function getSuggestionForError(errorCode: ParsingErrorCode): string {
  switch (errorCode) {
    case 'EMPTY_FILE':
      return 'The file appears to be empty. Please check that you selected the correct file.'
    case 'INVALID_FILE':
      return 'This does not appear to be a valid DRF file. Make sure the file has a .drf extension and was downloaded from Daily Racing Form.'
    case 'CORRUPTED_DATA':
      return 'The file may be corrupted or incomplete. Try downloading a fresh copy from the source.'
    case 'UNSUPPORTED_FORMAT':
      return 'This file format is not supported. Please use standard DRF single-file format (.drf).'
    case 'MISSING_REQUIRED_FIELD':
      return 'The file is missing required data fields. It may be an incomplete download.'
    case 'INVALID_FIELD_VALUE':
      return 'Some data values in the file are invalid. The file may need to be regenerated.'
    default:
      return 'An unexpected error occurred. Please try again or contact support.'
  }
}

/**
 * Send a progress update to the main thread
 */
function sendProgress(message: DRFWorkerProgressMessage): void {
  self.postMessage(message)
}

/**
 * Handle incoming parse requests
 */
self.onmessage = (event: MessageEvent<DRFWorkerRequest>) => {
  const { type, fileContent, filename } = event.data

  if (type === 'parse') {
    try {
      // Validate input
      if (!fileContent) {
        const response: DRFWorkerErrorResponse = {
          type: 'error',
          error: 'No file content provided',
          errorCode: 'EMPTY_FILE',
          details: {
            suggestion: 'Please select a valid DRF file to parse.',
          },
        }
        self.postMessage(response)
        return
      }

      // Check file size (max 50MB)
      const fileSizeBytes = new Blob([fileContent]).size
      const maxSizeBytes = 50 * 1024 * 1024 // 50MB
      if (fileSizeBytes > maxSizeBytes) {
        const response: DRFWorkerErrorResponse = {
          type: 'error',
          error: `File too large: ${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB exceeds 50MB limit`,
          errorCode: 'INVALID_FILE',
          details: {
            suggestion: 'Please use a smaller DRF file. The maximum supported size is 50MB.',
          },
        }
        self.postMessage(response)
        return
      }

      // Quick validation of file content
      const firstLine = fileContent.split('\n')[0]
      if (!firstLine || firstLine.trim().length === 0) {
        const response: DRFWorkerErrorResponse = {
          type: 'error',
          error: 'File appears to be empty or contains no valid data',
          errorCode: 'EMPTY_FILE',
          details: {
            suggestion: 'The file contains no parseable content. Please check the file.',
          },
        }
        self.postMessage(response)
        return
      }

      // Parse the file with progress callbacks
      const result = parseDRFFile(fileContent, filename, (progressMessage) => {
        // Forward progress updates to main thread
        sendProgress(progressMessage)
      })

      // Validate results
      if (!result.races || result.races.length === 0) {
        const response: DRFWorkerErrorResponse = {
          type: 'error',
          error: 'No races found in file',
          errorCode: 'INVALID_FILE',
          details: {
            suggestion: 'The file does not contain any valid race data. It may not be a DRF file.',
          },
        }
        self.postMessage(response)
        return
      }

      // Success response
      const response: DRFWorkerSuccessResponse = {
        type: 'success',
        data: result,
      }
      self.postMessage(response)
    } catch (error) {
      // Handle parsing errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error'
      const errorCode = error instanceof Error ? getErrorCode(error) : 'UNKNOWN_ERROR'
      const suggestion = getSuggestionForError(errorCode)

      const response: DRFWorkerErrorResponse = {
        type: 'error',
        error: errorMessage,
        errorCode,
        details: {
          suggestion,
        },
      }
      self.postMessage(response)
    }
  }
}

// Export type for worker
export type { DRFWorkerRequest, DRFWorkerResponse }
