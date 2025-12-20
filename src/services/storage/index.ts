/**
 * IndexedDB Storage Service
 *
 * Provides offline data persistence for:
 * - Parsed DRF files
 * - User preferences
 * - Cached calculations
 *
 * This is critical for offline functionality at the track.
 */

import type { ParsedDRFFile } from '../../types/drf'

// Database configuration
const DB_NAME = 'furlong-offline-db'
const DB_VERSION = 1

// Store names
const STORES = {
  RACE_DATA: 'race-data',
  PREFERENCES: 'preferences',
  CALCULATIONS: 'calculations',
} as const

// Default cache expiration time: 7 days
const DEFAULT_CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000

// Types for stored data
interface StoredRaceData {
  id: string
  filename: string
  data: ParsedDRFFile
  savedAt: Date
  trackCode: string
  raceDate: string
  expiresAt?: Date
}

interface SavedFileInfo {
  id: string
  name: string
  date: Date
  trackCode: string
  raceCount: number
}

interface UserPreferences {
  key: string
  value: unknown
  updatedAt: Date
  expiresAt?: Date
}

interface CachedCalculation {
  id: string
  raceId: string
  calculationType: string
  result: unknown
  calculatedAt: Date
  expiresAt?: Date
}

// Open database connection
let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[Storage] Failed to open database:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Race data store - for parsed DRF files
      if (!db.objectStoreNames.contains(STORES.RACE_DATA)) {
        const raceStore = db.createObjectStore(STORES.RACE_DATA, { keyPath: 'id' })
        raceStore.createIndex('filename', 'filename', { unique: false })
        raceStore.createIndex('trackCode', 'trackCode', { unique: false })
        raceStore.createIndex('savedAt', 'savedAt', { unique: false })
      }

      // Preferences store - for user settings
      if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
        db.createObjectStore(STORES.PREFERENCES, { keyPath: 'key' })
      }

      // Calculations store - for cached scoring results
      if (!db.objectStoreNames.contains(STORES.CALCULATIONS)) {
        const calcStore = db.createObjectStore(STORES.CALCULATIONS, { keyPath: 'id' })
        calcStore.createIndex('raceId', 'raceId', { unique: false })
        calcStore.createIndex('calculatedAt', 'calculatedAt', { unique: false })
      }
    }
  })

  return dbPromise
}

// Generate unique ID for race data
function generateRaceDataId(data: ParsedDRFFile): string {
  const track = data.races[0]?.header?.trackCode || 'unknown'
  const date = data.races[0]?.header?.raceDateRaw || new Date().toISOString().split('T')[0]
  const hash = data.filename.split('.')[0]
  return `${track}-${date}-${hash}`
}

// ============================================================================
// RACE DATA OPERATIONS
// ============================================================================

/**
 * Save parsed DRF file data to IndexedDB
 * @param fileId - Unique identifier for the file
 * @param data - Parsed DRF file data
 * @param expirationMs - Optional custom expiration time in milliseconds (default: 7 days)
 */
export async function saveRaceData(
  fileId: string,
  data: ParsedDRFFile,
  expirationMs: number = DEFAULT_CACHE_EXPIRATION_MS
): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.RACE_DATA, 'readwrite')
  const store = tx.objectStore(STORES.RACE_DATA)

  const trackCode = data.races[0]?.header?.trackCode || 'unknown'
  const raceDate = data.races[0]?.header?.raceDateRaw || ''
  const now = new Date()

  const storedData: StoredRaceData = {
    id: fileId,
    filename: data.filename,
    data,
    savedAt: now,
    trackCode,
    raceDate,
    expiresAt: new Date(now.getTime() + expirationMs),
  }

  return new Promise((resolve, reject) => {
    const request = store.put(storedData)
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to save race data:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Get parsed DRF file data from IndexedDB
 */
export async function getRaceData(fileId: string): Promise<ParsedDRFFile | null> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.RACE_DATA, 'readonly')
  const store = tx.objectStore(STORES.RACE_DATA)

  return new Promise((resolve, reject) => {
    const request = store.get(fileId)
    request.onsuccess = () => {
      const result = request.result as StoredRaceData | undefined
      resolve(result?.data ?? null)
    }
    request.onerror = () => {
      console.error('[Storage] Failed to get race data:', request.error)
      reject(request.error)
    }
  })
}

/**
 * List all saved DRF files
 */
export async function listSavedFiles(): Promise<SavedFileInfo[]> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.RACE_DATA, 'readonly')
  const store = tx.objectStore(STORES.RACE_DATA)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      const results = (request.result as StoredRaceData[]).map((item) => ({
        id: item.id,
        name: item.filename,
        date: item.savedAt,
        trackCode: item.trackCode,
        raceCount: item.data.races.length,
      }))
      // Sort by date, most recent first
      results.sort((a, b) => b.date.getTime() - a.date.getTime())
      resolve(results)
    }
    request.onerror = () => {
      console.error('[Storage] Failed to list saved files:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Delete saved DRF file data
 */
export async function deleteRaceData(fileId: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.RACE_DATA, 'readwrite')
  const store = tx.objectStore(STORES.RACE_DATA)

  return new Promise((resolve, reject) => {
    const request = store.delete(fileId)
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to delete race data:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Clear all saved race data
 */
export async function clearAllRaceData(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.RACE_DATA, 'readwrite')
  const store = tx.objectStore(STORES.RACE_DATA)

  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to clear race data:', request.error)
      reject(request.error)
    }
  })
}

// ============================================================================
// PREFERENCES OPERATIONS
// ============================================================================

/**
 * Save user preference
 */
export async function savePreference(key: string, value: unknown): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.PREFERENCES, 'readwrite')
  const store = tx.objectStore(STORES.PREFERENCES)

  const pref: UserPreferences = {
    key,
    value,
    updatedAt: new Date(),
  }

  return new Promise((resolve, reject) => {
    const request = store.put(pref)
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to save preference:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Get user preference
 */
export async function getPreference<T>(key: string, defaultValue: T): Promise<T> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.PREFERENCES, 'readonly')
  const store = tx.objectStore(STORES.PREFERENCES)

  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => {
      const result = request.result as UserPreferences | undefined
      resolve((result?.value as T) ?? defaultValue)
    }
    request.onerror = () => {
      console.error('[Storage] Failed to get preference:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Delete user preference
 */
export async function deletePreference(key: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.PREFERENCES, 'readwrite')
  const store = tx.objectStore(STORES.PREFERENCES)

  return new Promise((resolve, reject) => {
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to delete preference:', request.error)
      reject(request.error)
    }
  })
}

// ============================================================================
// CALCULATIONS CACHE OPERATIONS
// ============================================================================

/**
 * Save cached calculation result
 */
export async function saveCachedCalculation(
  raceId: string,
  calculationType: string,
  result: unknown
): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.CALCULATIONS, 'readwrite')
  const store = tx.objectStore(STORES.CALCULATIONS)

  const id = `${raceId}-${calculationType}`
  const calc: CachedCalculation = {
    id,
    raceId,
    calculationType,
    result,
    calculatedAt: new Date(),
  }

  return new Promise((resolve, reject) => {
    const request = store.put(calc)
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to save calculation:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Get cached calculation result
 */
export async function getCachedCalculation<T>(
  raceId: string,
  calculationType: string
): Promise<T | null> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.CALCULATIONS, 'readonly')
  const store = tx.objectStore(STORES.CALCULATIONS)

  const id = `${raceId}-${calculationType}`

  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const result = request.result as CachedCalculation | undefined
      resolve((result?.result as T) ?? null)
    }
    request.onerror = () => {
      console.error('[Storage] Failed to get calculation:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Clear all cached calculations for a race
 */
export async function clearRaceCalculations(raceId: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.CALCULATIONS, 'readwrite')
  const store = tx.objectStore(STORES.CALCULATIONS)
  const index = store.index('raceId')

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(raceId))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => {
      console.error('[Storage] Failed to clear calculations:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Clear all cached calculations
 */
export async function clearAllCalculations(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.CALCULATIONS, 'readwrite')
  const store = tx.objectStore(STORES.CALCULATIONS)

  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to clear all calculations:', request.error)
      reject(request.error)
    }
  })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if IndexedDB is available
 */
export function isStorageAvailable(): boolean {
  try {
    return 'indexedDB' in window && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Get storage usage estimate (if available)
 */
export async function getStorageEstimate(): Promise<{
  usage: number
  quota: number
  usagePercent: number
} | null> {
  if (!navigator.storage?.estimate) return null

  try {
    const estimate = await navigator.storage.estimate()
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      usagePercent: estimate.quota
        ? ((estimate.usage || 0) / estimate.quota) * 100
        : 0,
    }
  } catch {
    return null
  }
}

/**
 * Request persistent storage (prevents browser from clearing cache)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false

  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/**
 * Check if storage is persistent
 */
export async function isStoragePersistent(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false

  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

// Export utility for generating IDs
export { generateRaceDataId }

// ============================================================================
// SECURITY FUNCTIONS
// ============================================================================

/**
 * Clear all expired cached items from all stores.
 * Should be called periodically (e.g., on app start) to clean up old data.
 *
 * @returns Number of expired items cleared
 */
export async function clearExpiredData(): Promise<number> {
  const db = await openDatabase()
  const now = new Date()
  let clearedCount = 0

  // Clear expired race data
  const raceDataTx = db.transaction(STORES.RACE_DATA, 'readwrite')
  const raceStore = raceDataTx.objectStore(STORES.RACE_DATA)

  await new Promise<void>((resolve, reject) => {
    const request = raceStore.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const data = cursor.value as StoredRaceData
        if (data.expiresAt && new Date(data.expiresAt) < now) {
          cursor.delete()
          clearedCount++
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })

  // Clear expired calculations
  const calcTx = db.transaction(STORES.CALCULATIONS, 'readwrite')
  const calcStore = calcTx.objectStore(STORES.CALCULATIONS)

  await new Promise<void>((resolve, reject) => {
    const request = calcStore.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const data = cursor.value as CachedCalculation
        if (data.expiresAt && new Date(data.expiresAt) < now) {
          cursor.delete()
          clearedCount++
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })

  // Clear expired preferences
  const prefTx = db.transaction(STORES.PREFERENCES, 'readwrite')
  const prefStore = prefTx.objectStore(STORES.PREFERENCES)

  await new Promise<void>((resolve, reject) => {
    const request = prefStore.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const data = cursor.value as UserPreferences
        if (data.expiresAt && new Date(data.expiresAt) < now) {
          cursor.delete()
          clearedCount++
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => reject(request.error)
  })

  if (clearedCount > 0) {
    console.log(`[Storage] Cleared ${clearedCount} expired items`)
  }

  return clearedCount
}

/**
 * Clear all sensitive data on logout.
 * This should be called when the user logs out to ensure no
 * sensitive information remains in client storage.
 *
 * Clears:
 * - All cached calculations
 * - All user preferences
 * - Auth-related localStorage keys
 *
 * Does NOT clear:
 * - Race data (non-sensitive, allows offline access)
 */
export async function clearSensitiveDataOnLogout(): Promise<void> {
  // Clear IndexedDB stores with potentially sensitive data
  await Promise.all([
    clearAllCalculations(),
    clearAllPreferences(),
  ])

  // Clear auth-related localStorage keys
  // Pattern matches auth storage keys from auth service
  const authKeyPatterns = [
    'handicap_app_auth',
    'handicap_app_auth_users',
    'handicap_app_auth_pwd_',
  ]

  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && authKeyPatterns.some((pattern) => key.startsWith(pattern))) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key))

  console.log('[Storage] Cleared sensitive data on logout')
}

/**
 * Clear all user preferences
 */
async function clearAllPreferences(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORES.PREFERENCES, 'readwrite')
  const store = tx.objectStore(STORES.PREFERENCES)

  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => {
      console.error('[Storage] Failed to clear preferences:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Sanitize data before storage.
 * This helper can be used to ensure data is clean before storing.
 *
 * Note: Import sanitization utilities from src/lib/sanitization.ts
 * for comprehensive input sanitization before passing to storage.
 */
export function sanitizeStorageKey(key: string): string {
  // Remove any characters that could cause issues with IndexedDB keys
  return key
    .replace(/[^\w\-_.]/g, '_')
    .substring(0, 255)
}
