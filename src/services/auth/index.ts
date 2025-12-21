/**
 * Auth Service Implementation
 *
 * Provides authentication services with support for multiple providers.
 * Currently implements a mock provider for development/testing.
 * Ready for Supabase or Firebase integration.
 */

import type {
  User,
  UserData,
  AuthState,
  AuthConfig,
  AuthError,
  AuthStateCallback,
  Unsubscribe,
  IAuthService,
} from './types';

import {
  initialAuthState,
  defaultAuthConfig,
  createAuthError,
  userToData,
  dataToUser,
} from './types';

// Re-export types for convenience
export * from './types';

// ============================================================================
// MOCK AUTH SERVICE
// ============================================================================

/**
 * Mock auth service for development and testing
 * Stores user data in localStorage and simulates async operations
 */
class MockAuthService implements IAuthService {
  private config: AuthConfig;
  private state: AuthState = { ...initialAuthState };
  private listeners: Set<AuthStateCallback> = new Set();
  private storageKey: string;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = { ...defaultAuthConfig, ...config };
    this.storageKey = this.config.storageKey || 'handicap_app_auth';
    this.initializeFromStorage();
  }

  /**
   * Initialize auth state from localStorage
   */
  private initializeFromStorage(): void {
    if (!this.config.persistAuth) {
      this.updateState({ isLoading: false });
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const userData: UserData = JSON.parse(stored);
        const user = dataToUser(userData);
        this.updateState({
          user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        this.updateState({ isLoading: false });
      }
    } catch {
      // Invalid stored data, clear it
      localStorage.removeItem(this.storageKey);
      this.updateState({ isLoading: false });
    }
  }

  /**
   * Simulate async delay for realistic testing
   */
  private async delay(): Promise<void> {
    const ms = this.config.mockDelayMs || 500;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update auth state and notify listeners
   */
  private updateState(updates: Partial<AuthState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((callback) => callback(this.state));
  }

  /**
   * Persist user to localStorage
   */
  private persistUser(user: User): void {
    if (this.config.persistAuth) {
      const userData = userToData(user);
      localStorage.setItem(this.storageKey, JSON.stringify(userData));
    }
  }

  /**
   * Clear persisted user from localStorage
   */
  private clearPersistedUser(): void {
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Get stored users registry (for mock email exists check)
   */
  private getStoredUsers(): Record<string, UserData> {
    try {
      const stored = localStorage.getItem(`${this.storageKey}_users`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save user to users registry
   */
  private saveToUsersRegistry(user: User, password: string): void {
    const users = this.getStoredUsers();
    users[user.email.toLowerCase()] = {
      ...userToData(user),
      // Store hashed password (in real implementation this would be on server)
      // For mock, we just store it - NOT SECURE, development only
    };
    // Store password separately (mock only - real auth handles this server-side)
    localStorage.setItem(`${this.storageKey}_pwd_${user.email.toLowerCase()}`, btoa(password));
    localStorage.setItem(`${this.storageKey}_users`, JSON.stringify(users));
  }

  /**
   * Verify password for user (mock implementation)
   */
  private verifyPassword(email: string, password: string): boolean {
    const stored = localStorage.getItem(`${this.storageKey}_pwd_${email.toLowerCase()}`);
    if (!stored) return false;
    return atob(stored) === password;
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): AuthError | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createAuthError('INVALID_EMAIL', 'Please enter a valid email address');
    }
    return null;
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): AuthError | null {
    if (password.length < 6) {
      return createAuthError('WEAK_PASSWORD', 'Password must be at least 6 characters long');
    }
    return null;
  }

  /**
   * Generate a unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ============================================================================
  // IAuthService Implementation
  // ============================================================================

  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    await this.delay();

    // Validate email
    const emailError = this.validateEmail(email);
    if (emailError) {
      this.updateState({ error: emailError });
      throw emailError;
    }

    // Validate password
    const passwordError = this.validatePassword(password);
    if (passwordError) {
      this.updateState({ error: passwordError });
      throw passwordError;
    }

    // Check if email already exists
    const users = this.getStoredUsers();
    if (users[email.toLowerCase()]) {
      const error = createAuthError(
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists'
      );
      this.updateState({ error });
      throw error;
    }

    // Create new user
    const now = new Date();
    const user: User = {
      id: this.generateUserId(),
      email: email.toLowerCase(),
      displayName: displayName || null,
      createdAt: now,
      lastLoginAt: now,
      emailVerified: false,
    };

    // Save to registry and persist
    this.saveToUsersRegistry(user, password);
    this.persistUser(user);

    // Update state
    this.updateState({
      user,
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });

    return user;
  }

  async signIn(email: string, password: string): Promise<User> {
    await this.delay();

    // Validate email
    const emailError = this.validateEmail(email);
    if (emailError) {
      this.updateState({ error: emailError });
      throw emailError;
    }

    // Check if user exists
    const users = this.getStoredUsers();
    const userData = users[email.toLowerCase()];

    if (!userData) {
      const error = createAuthError('USER_NOT_FOUND', 'No account found with this email');
      this.updateState({ error });
      throw error;
    }

    // Verify password
    if (!this.verifyPassword(email, password)) {
      const error = createAuthError('WRONG_PASSWORD', 'Incorrect password');
      this.updateState({ error });
      throw error;
    }

    // Update last login time
    const user = dataToUser(userData);
    user.lastLoginAt = new Date();

    // Update registry with new lastLoginAt
    this.saveToUsersRegistry(user, password);
    this.persistUser(user);

    // Update state
    this.updateState({
      user,
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });

    return user;
  }

  async signOut(): Promise<void> {
    await this.delay();

    this.clearPersistedUser();
    this.updateState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  }

  getCurrentUser(): User | null {
    return this.state.user;
  }

  getAuthState(): AuthState {
    return { ...this.state };
  }

  onAuthStateChange(callback: AuthStateCallback): Unsubscribe {
    this.listeners.add(callback);
    // Immediately call with current state
    callback(this.state);

    return () => {
      this.listeners.delete(callback);
    };
  }

  async resetPassword(email: string): Promise<void> {
    await this.delay();

    // Validate email
    const emailError = this.validateEmail(email);
    if (emailError) {
      throw emailError;
    }

    // Check if user exists
    const users = this.getStoredUsers();
    if (!users[email.toLowerCase()]) {
      const error = createAuthError('USER_NOT_FOUND', 'No account found with this email');
      throw error;
    }

    // In mock, we just simulate success
    // Real implementation would send email
    console.log(`[Mock Auth] Password reset email would be sent to: ${email}`);
  }

  async emailExists(email: string): Promise<boolean> {
    await this.delay();
    const users = this.getStoredUsers();
    return Boolean(users[email.toLowerCase()]);
  }

  async updateProfile(updates: Partial<Pick<User, 'displayName' | 'avatarUrl'>>): Promise<User> {
    await this.delay();

    if (!this.state.user) {
      const error = createAuthError('UNAUTHORIZED', 'Must be signed in to update profile');
      throw error;
    }

    const updatedUser: User = {
      ...this.state.user,
      ...updates,
    };

    this.persistUser(updatedUser);
    this.updateState({ user: updatedUser });

    return updatedUser;
  }
}

// ============================================================================
// AUTH SERVICE FACTORY
// ============================================================================

/**
 * Create an auth service instance based on configuration
 */
export function createAuthService(config: Partial<AuthConfig> = {}): IAuthService {
  const finalConfig = { ...defaultAuthConfig, ...config };

  switch (finalConfig.provider) {
    case 'supabase':
      // TODO: Return Supabase implementation when ready
      console.warn('[Auth] Supabase provider not yet implemented, using mock');
      return new MockAuthService(finalConfig);

    case 'firebase':
      // TODO: Return Firebase implementation when ready
      console.warn('[Auth] Firebase provider not yet implemented, using mock');
      return new MockAuthService(finalConfig);

    case 'mock':
    default:
      return new MockAuthService(finalConfig);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let authServiceInstance: IAuthService | null = null;

/**
 * Get the singleton auth service instance
 * Creates one if it doesn't exist
 */
export function getAuthService(config?: Partial<AuthConfig>): IAuthService {
  if (!authServiceInstance) {
    authServiceInstance = createAuthService(config);
  }
  return authServiceInstance;
}

/**
 * Reset the auth service instance (useful for testing)
 */
export function resetAuthService(): void {
  authServiceInstance = null;
}

/**
 * Export the AuthService class for direct instantiation if needed
 */
export { MockAuthService };

/**
 * Default export is the singleton getter
 */
export default getAuthService;
