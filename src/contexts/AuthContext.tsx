/* eslint-disable react-refresh/only-export-components */
/**
 * AuthContext
 *
 * Provides authentication state to the component tree.
 * Wraps the app in an AuthProvider to enable useAuth hook.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { getAuthService } from '../services/auth';
import type { User, AuthState, AuthError, IAuthService } from '../services/auth/types';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

export interface AuthContextValue {
  /** Currently authenticated user, or null */
  user: User | null;
  /** Whether auth state is being loaded */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Current auth error, if any */
  error: AuthError | null;
  /** Sign up a new user */
  signUp: (email: string, password: string, displayName?: string) => Promise<User>;
  /** Sign in an existing user */
  signIn: (email: string, password: string) => Promise<User>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
  /** Send password reset email */
  resetPassword: (email: string) => Promise<void>;
  /** Clear current error */
  clearError: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component
 *
 * Wraps the application to provide auth state via context.
 *
 * @example
 * ```tsx
 * // In App.tsx or main.tsx
 * function App() {
 *   return (
 *     <AuthProvider>
 *       <Router>
 *         <Routes />
 *       </Router>
 *     </AuthProvider>
 *   )
 * }
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [authService] = useState<IAuthService>(() => getAuthService());
  const [state, setState] = useState<AuthState>(() => authService.getAuthState());
  const [localError, setLocalError] = useState<AuthError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [authService]);

  // Sign up action
  const signUp = useCallback(
    async (email: string, password: string, displayName?: string): Promise<User> => {
      setLocalError(null);
      setIsProcessing(true);

      try {
        const user = await authService.signUp(email, password, displayName);
        return user;
      } catch (err) {
        const error = err as AuthError;
        setLocalError(error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [authService]
  );

  // Sign in action
  const signIn = useCallback(
    async (email: string, password: string): Promise<User> => {
      setLocalError(null);
      setIsProcessing(true);

      try {
        const user = await authService.signIn(email, password);
        return user;
      } catch (err) {
        const error = err as AuthError;
        setLocalError(error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [authService]
  );

  // Sign out action
  const signOut = useCallback(async (): Promise<void> => {
    setLocalError(null);
    setIsProcessing(true);

    try {
      await authService.signOut();
    } catch (err) {
      const error = err as AuthError;
      setLocalError(error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [authService]);

  // Reset password action
  const resetPassword = useCallback(
    async (email: string): Promise<void> => {
      setLocalError(null);
      setIsProcessing(true);

      try {
        await authService.resetPassword(email);
      } catch (err) {
        const error = err as AuthError;
        setLocalError(error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [authService]
  );

  // Clear error
  const clearError = useCallback(() => {
    setLocalError(null);
  }, []);

  // Combine auth state loading with local processing
  const isLoading = state.isLoading || isProcessing;

  // Combine errors (prefer local error for immediate feedback)
  const error = localError || state.error;

  const value: AuthContextValue = useMemo(
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
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access auth context
 *
 * Must be used within an AuthProvider.
 * For standalone usage without context, use useAuth from hooks/useAuth.ts
 *
 * @example
 * ```tsx
 * function ProfileButton() {
 *   const { user, signOut, isAuthenticated } = useAuthContext()
 *
 *   if (!isAuthenticated) return <LoginButton />
 *
 *   return (
 *     <div>
 *       <span>{user?.displayName || user?.email}</span>
 *       <button onClick={signOut}>Sign Out</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

// ============================================================================
// OPTIONAL CONTEXT HOOK
// ============================================================================

/**
 * Hook to optionally access auth context
 * Returns null if not within an AuthProvider
 * Useful for components that work with or without auth
 */
export function useOptionalAuthContext(): AuthContextValue | null {
  return useContext(AuthContext);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { AuthContext };
export default AuthProvider;
