/**
 * Auth Service Type Definitions
 *
 * Provides type-safe abstractions for authentication services.
 * Designed to work with Supabase, Firebase, or mock implementations.
 */

// ============================================================================
// USER TYPES
// ============================================================================

/**
 * Core user type representing an authenticated user
 */
export interface User {
  /** Unique user identifier (from auth provider) */
  id: string
  /** User's email address */
  email: string
  /** Display name (optional) */
  displayName: string | null
  /** Account creation timestamp */
  createdAt: Date
  /** Last login timestamp */
  lastLoginAt: Date
  /** Avatar URL (optional) */
  avatarUrl?: string | null
  /** Email verification status */
  emailVerified?: boolean
}

/**
 * User data for storage (JSON-serializable version)
 */
export interface UserData {
  id: string
  email: string
  displayName: string | null
  createdAt: string
  lastLoginAt: string
  avatarUrl?: string | null
  emailVerified?: boolean
}

// ============================================================================
// AUTH STATE
// ============================================================================

/**
 * Authentication state container
 */
export interface AuthState {
  /** Currently authenticated user, or null if not authenticated */
  user: User | null
  /** Whether auth state is being loaded/checked */
  isLoading: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Current auth error, if any */
  error: AuthError | null
}

/**
 * Initial auth state for providers
 */
export const initialAuthState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
}

// ============================================================================
// AUTH PROVIDERS
// ============================================================================

/**
 * Supported authentication providers
 */
export type AuthProvider = 'supabase' | 'firebase' | 'mock'

/**
 * Configuration for auth service
 */
export interface AuthConfig {
  /** Which auth provider to use */
  provider: AuthProvider
  /** Mock delay in ms (for mock provider) */
  mockDelayMs?: number
  /** Storage key for persisting auth state */
  storageKey?: string
  /** Whether to persist auth state */
  persistAuth?: boolean
}

/**
 * Default auth configuration
 */
export const defaultAuthConfig: AuthConfig = {
  provider: 'mock',
  mockDelayMs: 500,
  storageKey: 'handicap_app_auth',
  persistAuth: true,
}

// ============================================================================
// AUTH ERRORS
// ============================================================================

/**
 * Auth error codes
 */
export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'EMAIL_ALREADY_EXISTS'
  | 'USER_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'WEAK_PASSWORD'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_ERROR'

/**
 * Structured auth error
 */
export interface AuthError {
  code: AuthErrorCode
  message: string
  originalError?: unknown
}

/**
 * Create a typed auth error
 */
export function createAuthError(
  code: AuthErrorCode,
  message: string,
  originalError?: unknown
): AuthError {
  return { code, message, originalError }
}

// ============================================================================
// AUTH SERVICE INTERFACE
// ============================================================================

/**
 * Unsubscribe function returned by listeners
 */
export type Unsubscribe = () => void

/**
 * Auth state change callback
 */
export type AuthStateCallback = (state: AuthState) => void

/**
 * Sign up credentials
 */
export interface SignUpCredentials {
  email: string
  password: string
  displayName?: string
}

/**
 * Sign in credentials
 */
export interface SignInCredentials {
  email: string
  password: string
}

/**
 * Auth service interface
 * All auth providers must implement this interface
 */
export interface IAuthService {
  /**
   * Sign up a new user with email and password
   * @throws AuthError on failure
   */
  signUp(email: string, password: string, displayName?: string): Promise<User>

  /**
   * Sign in an existing user
   * @throws AuthError on failure
   */
  signIn(email: string, password: string): Promise<User>

  /**
   * Sign out the current user
   */
  signOut(): Promise<void>

  /**
   * Get the currently authenticated user
   * Returns null if not authenticated
   */
  getCurrentUser(): User | null

  /**
   * Subscribe to auth state changes
   * Returns an unsubscribe function
   */
  onAuthStateChange(callback: AuthStateCallback): Unsubscribe

  /**
   * Send password reset email
   * @throws AuthError on failure
   */
  resetPassword(email: string): Promise<void>

  /**
   * Check if email exists in system
   */
  emailExists?(email: string): Promise<boolean>

  /**
   * Update user profile
   */
  updateProfile?(updates: Partial<Pick<User, 'displayName' | 'avatarUrl'>>): Promise<User>

  /**
   * Get current auth state
   */
  getAuthState(): AuthState
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Result type for async auth operations
 */
export type AuthResult<T> =
  | { success: true; data: T }
  | { success: false; error: AuthError }

/**
 * Wrap async auth operation in result type
 */
export async function wrapAuthResult<T>(
  operation: () => Promise<T>
): Promise<AuthResult<T>> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    if (isAuthError(error)) {
      return { success: false, error }
    }
    return {
      success: false,
      error: createAuthError('UNKNOWN_ERROR', 'An unexpected error occurred', error),
    }
  }
}

/**
 * Type guard for AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  )
}

/**
 * Convert User to UserData for storage
 */
export function userToData(user: User): UserData {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
  }
}

/**
 * Convert UserData to User
 */
export function dataToUser(data: UserData): User {
  return {
    id: data.id,
    email: data.email,
    displayName: data.displayName,
    createdAt: new Date(data.createdAt),
    lastLoginAt: new Date(data.lastLoginAt),
    avatarUrl: data.avatarUrl,
    emailVerified: data.emailVerified,
  }
}
