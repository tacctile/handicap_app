import { parseDRFFile } from './drfParser'
import type { DRFWorkerRequest, DRFWorkerResponse } from '../types/drf'

/**
 * Web Worker for parsing DRF files.
 * Offloads parsing to a background thread to avoid blocking the UI.
 */

self.onmessage = (event: MessageEvent<DRFWorkerRequest>) => {
  const { type, fileContent, filename } = event.data

  if (type === 'parse') {
    try {
      const result = parseDRFFile(fileContent, filename)
      const response: DRFWorkerResponse = {
        type: 'success',
        data: result,
      }
      self.postMessage(response)
    } catch (error) {
      const response: DRFWorkerResponse = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      }
      self.postMessage(response)
    }
  }
}
