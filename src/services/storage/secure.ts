/**
 * Secure Storage Wrapper
 *
 * Encryption-ready interface for storing sensitive data.
 * Currently provides a passthrough implementation with the interface
 * designed to support encryption when needed.
 *
 * IMPORTANT: This module provides the INTERFACE for secure storage.
 * Actual encryption implementation should be added when:
 * - Handling payment information
 * - Storing sensitive user data
 * - PII that requires protection at rest
 *
 * When implementing encryption:
 * 1. Use Web Crypto API (SubtleCrypto)
 * 2. AES-GCM is recommended for data encryption
 * 3. Key derivation should use PBKDF2 or Argon2
 * 4. Keys should NEVER be stored in localStorage
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Options for secure storage operations
 */
export interface SecureStorageOptions {
  /** Time-to-live in milliseconds. Data expires after this duration. */
  ttl?: number;
  /** Whether this data requires encryption (future implementation) */
  encrypt?: boolean;
  /** Storage scope for namespacing */
  scope?: string;
}

/**
 * Wrapper for stored data with metadata
 */
interface SecureStorageEntry<T> {
  /** The actual data being stored */
  data: T;
  /** When this entry was created */
  createdAt: number;
  /** When this entry expires (undefined = never) */
  expiresAt?: number;
  /** Version for future migration support */
  version: number;
  /** Whether data is encrypted (for future use) */
  encrypted: boolean;
  /** Scope/namespace for this entry */
  scope: string;
}

/**
 * Interface for encryption provider (to be implemented)
 */
export interface IEncryptionProvider {
  encrypt(data: string): Promise<string>;
  decrypt(data: string): Promise<string>;
  isAvailable(): boolean;
}

/**
 * Result of a secure storage operation
 */
export interface SecureStorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORAGE_VERSION = 1;
const DEFAULT_SCOPE = 'app';
const STORAGE_PREFIX = 'furlong_secure_';

// ============================================================================
// PLACEHOLDER ENCRYPTION PROVIDER
// ============================================================================

/**
 * Placeholder encryption provider.
 * Does NOT actually encrypt - just passes through data.
 * Replace with real implementation when needed.
 */
class PlaceholderEncryptionProvider implements IEncryptionProvider {
  async encrypt(data: string): Promise<string> {
    // WARNING: This is NOT encryption - placeholder only
    // In production, implement using Web Crypto API
    return btoa(encodeURIComponent(data));
  }

  async decrypt(data: string): Promise<string> {
    // WARNING: This is NOT decryption - placeholder only
    try {
      return decodeURIComponent(atob(data));
    } catch {
      throw new Error('Failed to decode data');
    }
  }

  isAvailable(): boolean {
    // Placeholder always available
    // Real implementation should check for crypto API availability
    return true;
  }
}

// ============================================================================
// SECURE STORAGE CLASS
// ============================================================================

/**
 * Secure storage service for sensitive data.
 *
 * Usage:
 * ```typescript
 * const secureStorage = new SecureStorage()
 *
 * // Store sensitive data
 * await secureStorage.set('user_prefs', { theme: 'dark' }, { ttl: 86400000 })
 *
 * // Retrieve data
 * const result = await secureStorage.get<UserPrefs>('user_prefs')
 * if (result.success) {
 *   console.log(result.data)
 * }
 *
 * // Clear on logout
 * await secureStorage.clearScope('user')
 * ```
 */
export class SecureStorage {
  private encryptionProvider: IEncryptionProvider;
  private defaultScope: string;

  constructor(encryptionProvider?: IEncryptionProvider, defaultScope: string = DEFAULT_SCOPE) {
    this.encryptionProvider = encryptionProvider || new PlaceholderEncryptionProvider();
    this.defaultScope = defaultScope;
  }

  /**
   * Generate storage key with prefix and scope
   */
  private getStorageKey(key: string, scope: string): string {
    return `${STORAGE_PREFIX}${scope}_${key}`;
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: SecureStorageEntry<unknown>): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  /**
   * Store data securely
   *
   * @param key - Storage key
   * @param data - Data to store
   * @param options - Storage options
   */
  async set<T>(
    key: string,
    data: T,
    options: SecureStorageOptions = {}
  ): Promise<SecureStorageResult<void>> {
    try {
      const scope = options.scope || this.defaultScope;
      const storageKey = this.getStorageKey(key, scope);
      const now = Date.now();

      const entry: SecureStorageEntry<T> = {
        data,
        createdAt: now,
        expiresAt: options.ttl ? now + options.ttl : undefined,
        version: SECURE_STORAGE_VERSION,
        encrypted: options.encrypt || false,
        scope,
      };

      let serialized = JSON.stringify(entry);

      // Apply encoding (placeholder for encryption)
      if (options.encrypt && this.encryptionProvider.isAvailable()) {
        serialized = await this.encryptionProvider.encrypt(serialized);
      }

      // Use sessionStorage for more sensitive data that shouldn't persist
      // Use IndexedDB for larger data sets (see storage/index.ts)
      // localStorage is used here for simpler use cases
      localStorage.setItem(storageKey, serialized);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SecureStorage] Failed to set:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Retrieve data securely
   *
   * @param key - Storage key
   * @param options - Storage options (for scope)
   */
  async get<T>(
    key: string,
    options: Pick<SecureStorageOptions, 'scope'> = {}
  ): Promise<SecureStorageResult<T>> {
    try {
      const scope = options.scope || this.defaultScope;
      const storageKey = this.getStorageKey(key, scope);

      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return { success: false, error: 'Key not found' };
      }

      let serialized = stored;

      // Try to decrypt if it appears to be encoded
      // In real implementation, we'd have metadata about encryption
      try {
        if (this.encryptionProvider.isAvailable()) {
          serialized = await this.encryptionProvider.decrypt(stored);
        }
      } catch {
        // If decryption fails, try using raw value (backwards compatibility)
        serialized = stored;
      }

      const entry: SecureStorageEntry<T> = JSON.parse(serialized);

      // Check version for migration
      if (entry.version !== SECURE_STORAGE_VERSION) {
        // Future: handle data migration
        console.warn('[SecureStorage] Version mismatch, data may need migration');
      }

      // Check expiration
      if (this.isExpired(entry)) {
        await this.remove(key, { scope });
        return { success: false, error: 'Data expired' };
      }

      return { success: true, data: entry.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SecureStorage] Failed to get:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Remove data
   *
   * @param key - Storage key
   * @param options - Storage options (for scope)
   */
  async remove(
    key: string,
    options: Pick<SecureStorageOptions, 'scope'> = {}
  ): Promise<SecureStorageResult<void>> {
    try {
      const scope = options.scope || this.defaultScope;
      const storageKey = this.getStorageKey(key, scope);
      localStorage.removeItem(storageKey);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(key: string, options: Pick<SecureStorageOptions, 'scope'> = {}): Promise<boolean> {
    const result = await this.get(key, options);
    return result.success;
  }

  /**
   * Clear all data in a specific scope
   *
   * @param scope - Scope to clear
   */
  async clearScope(scope: string): Promise<SecureStorageResult<void>> {
    try {
      const prefix = `${STORAGE_PREFIX}${scope}_`;
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Clear all secure storage data
   */
  async clearAll(): Promise<SecureStorageResult<void>> {
    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Clear all expired entries
   *
   * @returns Number of entries cleared
   */
  async clearExpired(): Promise<number> {
    let clearedCount = 0;

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

      try {
        const stored = localStorage.getItem(key);
        if (!stored) continue;

        let serialized = stored;
        try {
          serialized = await this.encryptionProvider.decrypt(stored);
        } catch {
          // Use raw value if decryption fails
        }

        const entry: SecureStorageEntry<unknown> = JSON.parse(serialized);
        if (this.isExpired(entry)) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      } catch {
        // Skip entries that can't be parsed
      }
    }

    return clearedCount;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let secureStorageInstance: SecureStorage | null = null;

/**
 * Get the singleton secure storage instance
 */
export function getSecureStorage(scope?: string): SecureStorage {
  if (!secureStorageInstance) {
    secureStorageInstance = new SecureStorage(undefined, scope);
  }
  return secureStorageInstance;
}

/**
 * Reset the secure storage instance (for testing)
 */
export function resetSecureStorage(): void {
  secureStorageInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Quick access to secure storage operations
 */
export const secureStorage = {
  set: <T>(key: string, data: T, options?: SecureStorageOptions) =>
    getSecureStorage().set(key, data, options),

  get: <T>(key: string, options?: Pick<SecureStorageOptions, 'scope'>) =>
    getSecureStorage().get<T>(key, options),

  remove: (key: string, options?: Pick<SecureStorageOptions, 'scope'>) =>
    getSecureStorage().remove(key, options),

  has: (key: string, options?: Pick<SecureStorageOptions, 'scope'>) =>
    getSecureStorage().has(key, options),

  clearScope: (scope: string) => getSecureStorage().clearScope(scope),

  clearAll: () => getSecureStorage().clearAll(),

  clearExpired: () => getSecureStorage().clearExpired(),
};

export default secureStorage;
