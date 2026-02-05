/**
 * useAuth Hook (Stub)
 *
 * Minimal stub that bypasses authentication.
 * Auth features have been removed from the application.
 */

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: null;
}

/**
 * Stub hook that returns "always authenticated" state.
 * Auth functionality has been removed from this application.
 */
export function useAuth(): AuthState {
  return {
    isAuthenticated: true,
    isLoading: false,
    user: null,
  };
}

export default useAuth;
