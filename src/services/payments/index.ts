/**
 * Subscription/Payments Service Implementation
 *
 * Provides subscription services with support for multiple providers.
 * Currently implements a mock provider for development/testing.
 * Ready for Stripe integration.
 */

import type {
  Subscription,
  SubscriptionData,
  SubscriptionStatus,
  SubscriptionConfig,
  SubscriptionCallback,
  Plan,
  Unsubscribe,
  ISubscriptionService,
} from './types';

import {
  defaultSubscriptionConfig,
  DEFAULT_PLAN,
  createSubscriptionError,
  subscriptionToData,
  dataToSubscription,
  hasActiveAccess,
} from './types';

// Re-export types for convenience
export * from './types';

// ============================================================================
// MOCK SUBSCRIPTION SERVICE
// ============================================================================

/**
 * Mock subscription service for development and testing
 * Stores subscription data in localStorage and simulates async operations
 */
class MockSubscriptionService implements ISubscriptionService {
  private config: SubscriptionConfig;
  private storageKey: string;
  private listeners: Map<string, Set<SubscriptionCallback>> = new Map();
  private plans: Plan[];

  constructor(config: Partial<SubscriptionConfig> = {}) {
    this.config = { ...defaultSubscriptionConfig, ...config };
    this.storageKey = this.config.storageKey || 'handicap_app_subscription';
    this.plans = this.config.plans || [DEFAULT_PLAN];
  }

  /**
   * Simulate async delay for realistic testing
   */
  private async delay(): Promise<void> {
    const ms = this.config.mockDelayMs || 500;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get storage key for a user's subscription
   */
  private getUserStorageKey(userId: string): string {
    return `${this.storageKey}_${userId}`;
  }

  /**
   * Load subscription from localStorage
   */
  private loadSubscription(userId: string): Subscription | null {
    if (!this.config.persistSubscription) return null;

    try {
      const stored = localStorage.getItem(this.getUserStorageKey(userId));
      if (!stored) return null;

      const data: SubscriptionData = JSON.parse(stored);
      const plan = this.plans.find((p) => p.id === data.planId) || DEFAULT_PLAN;
      return dataToSubscription(data, plan);
    } catch {
      return null;
    }
  }

  /**
   * Save subscription to localStorage
   */
  private saveSubscription(subscription: Subscription): void {
    if (this.config.persistSubscription) {
      const data = subscriptionToData(subscription);
      localStorage.setItem(this.getUserStorageKey(subscription.userId), JSON.stringify(data));
    }
  }

  /**
   * Clear subscription from localStorage
   */
  private clearSubscription(userId: string): void {
    localStorage.removeItem(this.getUserStorageKey(userId));
  }

  /**
   * Notify listeners of subscription change
   */
  private notifyListeners(userId: string, subscription: Subscription | null): void {
    const userListeners = this.listeners.get(userId);
    if (userListeners) {
      userListeners.forEach((callback) => callback(subscription));
    }
  }

  /**
   * Generate a unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a new subscription for a user
   */
  private createSubscription(userId: string, planId: string): Subscription {
    const plan = this.plans.find((p) => p.id === planId) || DEFAULT_PLAN;
    const now = new Date();
    const periodEnd = new Date(now);

    // Add one month for monthly, one year for yearly
    if (plan.interval === 'month') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      userId,
      status: 'active',
      planId: plan.id,
      plan,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };

    return subscription;
  }

  // ============================================================================
  // ISubscriptionService Implementation
  // ============================================================================

  async getSubscription(userId: string): Promise<Subscription | null> {
    await this.delay();
    return this.loadSubscription(userId);
  }

  async createCheckoutSession(userId: string, planId: string): Promise<string> {
    await this.delay();

    // Validate plan exists
    const plan = this.plans.find((p) => p.id === planId);
    if (!plan) {
      throw createSubscriptionError('INVALID_PLAN', `Plan not found: ${planId}`);
    }

    // Check if already subscribed
    const existing = this.loadSubscription(userId);
    if (existing && hasActiveAccess(existing.status)) {
      throw createSubscriptionError(
        'ALREADY_SUBSCRIBED',
        'User already has an active subscription'
      );
    }

    // In mock, we simulate checkout by creating subscription directly
    const subscription = this.createSubscription(userId, planId);
    this.saveSubscription(subscription);
    this.notifyListeners(userId, subscription);

    // Return a mock checkout URL
    // In real implementation, this would be a Stripe checkout URL
    console.log(`[Mock Payments] Created subscription for user ${userId} on plan ${planId}`);
    return `https://mock-checkout.example.com/session/${subscription.id}`;
  }

  async createPortalSession(userId: string): Promise<string> {
    await this.delay();

    const subscription = this.loadSubscription(userId);
    if (!subscription) {
      throw createSubscriptionError('SUBSCRIPTION_NOT_FOUND', 'No subscription found for user');
    }

    // Return a mock portal URL
    console.log(`[Mock Payments] Created portal session for user ${userId}`);
    return `https://mock-portal.example.com/session/${userId}`;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.delay();

    // Find subscription by ID across all users
    // In mock, we iterate localStorage (not efficient, but works for testing)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(this.storageKey)) continue;

      try {
        const stored = localStorage.getItem(key);
        if (!stored) continue;

        const data: SubscriptionData = JSON.parse(stored);
        if (data.id === subscriptionId) {
          const plan = this.plans.find((p) => p.id === data.planId) || DEFAULT_PLAN;
          const subscription = dataToSubscription(data, plan);

          // Update subscription to cancel at period end
          subscription.cancelAtPeriodEnd = true;
          subscription.status = 'canceled';
          subscription.updatedAt = new Date();

          this.saveSubscription(subscription);
          this.notifyListeners(subscription.userId, subscription);

          console.log(`[Mock Payments] Canceled subscription ${subscriptionId}`);
          return;
        }
      } catch {
        continue;
      }
    }

    throw createSubscriptionError(
      'SUBSCRIPTION_NOT_FOUND',
      `Subscription not found: ${subscriptionId}`
    );
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.delay();

    // Find and resume subscription
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(this.storageKey)) continue;

      try {
        const stored = localStorage.getItem(key);
        if (!stored) continue;

        const data: SubscriptionData = JSON.parse(stored);
        if (data.id === subscriptionId) {
          const plan = this.plans.find((p) => p.id === data.planId) || DEFAULT_PLAN;
          const subscription = dataToSubscription(data, plan);

          // Resume subscription
          subscription.cancelAtPeriodEnd = false;
          subscription.status = 'active';
          subscription.updatedAt = new Date();

          this.saveSubscription(subscription);
          this.notifyListeners(subscription.userId, subscription);

          console.log(`[Mock Payments] Resumed subscription ${subscriptionId}`);
          return;
        }
      } catch {
        continue;
      }
    }

    throw createSubscriptionError(
      'SUBSCRIPTION_NOT_FOUND',
      `Subscription not found: ${subscriptionId}`
    );
  }

  onSubscriptionChange(userId: string, callback: SubscriptionCallback): Unsubscribe {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }

    this.listeners.get(userId)!.add(callback);

    // Immediately call with current subscription state
    const subscription = this.loadSubscription(userId);
    callback(subscription);

    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(callback);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  getPlans(): Plan[] {
    return [...this.plans];
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return subscription ? hasActiveAccess(subscription.status) : false;
  }

  /**
   * Mock-only: Set subscription status for testing
   */
  setMockSubscription(userId: string, status: SubscriptionStatus): void {
    if (status === 'none') {
      this.clearSubscription(userId);
      this.notifyListeners(userId, null);
      return;
    }

    let subscription = this.loadSubscription(userId);

    if (!subscription) {
      // Create a new subscription if none exists
      subscription = this.createSubscription(userId, DEFAULT_PLAN.id);
    }

    subscription.status = status;
    subscription.updatedAt = new Date();

    if (status === 'canceled') {
      subscription.cancelAtPeriodEnd = true;
    } else if (status === 'active') {
      subscription.cancelAtPeriodEnd = false;
    }

    this.saveSubscription(subscription);
    this.notifyListeners(userId, subscription);

    console.log(`[Mock Payments] Set subscription status for ${userId} to ${status}`);
  }
}

// ============================================================================
// SUBSCRIPTION SERVICE FACTORY
// ============================================================================

/**
 * Create a subscription service instance based on configuration
 */
export function createSubscriptionService(
  config: Partial<SubscriptionConfig> = {}
): ISubscriptionService {
  const finalConfig = { ...defaultSubscriptionConfig, ...config };

  switch (finalConfig.provider) {
    case 'stripe':
      // TODO: Return Stripe implementation when ready
      console.warn('[Payments] Stripe provider not yet implemented, using mock');
      return new MockSubscriptionService(finalConfig);

    case 'mock':
    default:
      return new MockSubscriptionService(finalConfig);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let subscriptionServiceInstance: ISubscriptionService | null = null;

/**
 * Get the singleton subscription service instance
 * Creates one if it doesn't exist
 */
export function getSubscriptionService(config?: Partial<SubscriptionConfig>): ISubscriptionService {
  if (!subscriptionServiceInstance) {
    subscriptionServiceInstance = createSubscriptionService(config);
  }
  return subscriptionServiceInstance;
}

/**
 * Reset the subscription service instance (useful for testing)
 */
export function resetSubscriptionService(): void {
  subscriptionServiceInstance = null;
}

/**
 * Export the MockSubscriptionService class for direct instantiation if needed
 */
export { MockSubscriptionService };

/**
 * Default export is the singleton getter
 */
export default getSubscriptionService;
