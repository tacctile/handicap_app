/**
 * useAuth Hook
 *
 * Provides authentication state and actions to React components.
 * Subscribes to auth state changes and handles loading states.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAuthService } from '../services/auth'
import type { User, AuthState, AuthError, IAuthService } from '../services/auth/types'

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface UseAuthReturn {
  /** Currently authenticated user, or null */
  user: User | null
  /** Whether auth state is being loaded */
  isLoading: boolean
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Current auth error, if any */
  error: AuthError | null
  /** Sign up a new user */
  signUp: (email: string, password: string, displayName?: string) => Promise<User>
  /** Sign in an existing user */
  signIn: (email: string, password: string) => Promise<User>
  /** Sign out the current user */
  signOut: () => Promise<void>
  /** Send password reset email */
  resetPassword: (email: string) => Promise<void>
  /** Clear current error */
  clearError: () => void
  /** Update user profile */
  updateProfile?: (updates: Partial<Pick<User, 'displayName' | 'avatarUrl'>>) => Promise<User>
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to access authentication state and actions
 *
 * @example
 * ```tsx
 * function LoginPage() {
 *   const { signIn, isLoading, error } = useAuth()
 *
 *   const handleSubmit = async (email: string, password: string) => {
 *     try {
 *       await signIn(email, password)
 *       // Redirect to dashboard
 *     } catch (err) {
 *       // Error is already in state
 *     }
 *   }
 *
 *   return (
 *     <form onSubmit={...}>
 *       {error && <p>{error.message}</p>}
 *       {isLoading && <Spinner />}
 *     </form>
 *   )
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [authService] = useState<IAuthService>(() => getAuthService())
  const [state, setState] = useState<AuthState>(() => authService.getAuthState())
  const [localError, setLocalError] = useState<AuthError | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((newState) => {
      setState(newState)
    })

    return () => {
      unsubscribe()
    }
  }, [authService])

  // Sign up action
  const signUp = useCallback(
    async (email: string, password: string, displayName?: string): Promise<User> => {
      setLocalError(null)
      setIsProcessing(true)

      try {
        const user = await authService.signUp(email, password, displayName)
        return user
      } catch (err) {
        const error = err as AuthError
        setLocalError(error)
        throw error
      } finally {
        setIsProcessing(false)
      }
    },
    [authService]
  )

  // Sign in action
  const signIn = useCallback(
    async (email: string, password: string): Promise<User> => {
      setLocalError(null)
      setIsProcessing(true)

      try {
        const user = await authService.signIn(email, password)
        return user
      } catch (err) {
        const error = err as AuthError
        setLocalError(error)
        throw error
      } finally {
        setIsProcessing(false)
      }
    },
    [authService]
  )

  // Sign out action
  const signOut = useCallback(async (): Promise<void> => {
    setLocalError(null)
    setIsProcessing(true)

    try {
      await authService.signOut()
    } catch (err) {
      const error = err as AuthError
      setLocalError(error)
      throw error
    } finally {
      setIsProcessing(false)
    }
  }, [authService])

  // Reset password action
  const resetPassword = useCallback(
    async (email: string): Promise<void> => {
      setLocalError(null)
      setIsProcessing(true)

      try {
        await authService.resetPassword(email)
      } catch (err) {
        const error = err as AuthError
        setLocalError(error)
        throw error
      } finally {
        setIsProcessing(false)
      }
    },
    [authService]
  )

  // Clear error
  const clearError = useCallback(() => {
    setLocalError(null)
  }, [])

  // Update profile (if supported)
  const updateProfile = useMemo(() => {
    if (!authService.updateProfile) return undefined

    return async (
      updates: Partial<Pick<User, 'displayName' | 'avatarUrl'>>
    ): Promise<User> => {
      setLocalError(null)
      setIsProcessing(true)

      try {
        const user = await authService.updateProfile!(updates)
        return user
      } catch (err) {
        const error = err as AuthError
        setLocalError(error)
        throw error
      } finally {
        setIsProcessing(false)
      }
    }
  }, [authService])

  // Combine auth state loading with local processing
  const isLoading = state.isLoading || isProcessing

  // Combine errors (prefer local error for immediate feedback)
  const error = localError || state.error

  return useMemo(
    () => ({
      user: state.user,
      isLoading,
      isAuthenticated: state.isAuthenticated,
      error,
      signUp,
      signIn,
      signOut,
      resetPassword,
      clearError,
      updateProfile,
    }),
    [
      state.user,
      isLoading,
      state.isAuthenticated,
      error,
      signUp,
      signIn,
      signOut,
      resetPassword,
      clearError,
      updateProfile,
    ]
  )
}

// ============================================================================
// STANDALONE HELPER
// ============================================================================

/**
 * Get current user without subscribing to changes
 * Useful for one-time checks in event handlers
 */
export function getCurrentUser(): User | null {
  return getAuthService().getCurrentUser()
}

/**
 * Check if user is currently authenticated
 * Useful for one-time checks in event handlers
 */
export function isAuthenticated(): boolean {
  return getAuthService().getCurrentUser() !== null
}

export default useAuth
