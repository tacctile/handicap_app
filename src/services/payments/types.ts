/**
 * Payments/Subscription Service Type Definitions
 *
 * Provides type-safe abstractions for subscription/payment services.
 * Designed to work with Stripe or mock implementations.
 */

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

/**
 * Possible subscription statuses
 */
export type SubscriptionStatus =
  | 'active' // Subscription is active and paid
  | 'canceled' // Subscription was canceled but may still have access until period end
  | 'past_due' // Payment failed, grace period
  | 'trialing' // In trial period
  | 'none'; // No subscription

/**
 * Check if a status grants access to paid features
 */
export function hasActiveAccess(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing';
}

// ============================================================================
// PLAN TYPES
// ============================================================================

/**
 * Billing interval
 */
export type BillingInterval = 'month' | 'year';

/**
 * Subscription plan definition
 */
export interface Plan {
  /** Unique plan identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Price in cents (e.g., 1999 = $19.99) */
  priceInCents: number;
  /** Formatted price string (e.g., "$19.99") */
  priceFormatted: string;
  /** Billing interval */
  interval: BillingInterval;
  /** Currency code */
  currency: string;
  /** Features included in this plan */
  features: string[];
  /** Whether this is the recommended plan */
  isRecommended?: boolean;
  /** Stripe price ID (for integration) */
  stripePriceId?: string;
}

/**
 * Default monthly plan
 */
export const DEFAULT_PLAN: Plan = {
  id: 'monthly',
  name: 'Pro Monthly',
  description: 'Full access to all handicapping features',
  priceInCents: 1999,
  priceFormatted: '$19.99',
  interval: 'month',
  currency: 'usd',
  features: [
    'Unlimited DRF file parsing',
    'Full scoring breakdowns',
    'All betting recommendations',
    'Track intelligence database',
    'Offline access',
  ],
  isRecommended: true,
};

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

/**
 * Subscription object representing a user's subscription state
 */
export interface Subscription {
  /** Subscription ID */
  id: string;
  /** User ID */
  userId: string;
  /** Current status */
  status: SubscriptionStatus;
  /** Plan ID */
  planId: string;
  /** Plan details */
  plan: Plan;
  /** Start of current billing period */
  currentPeriodStart: Date;
  /** End of current billing period */
  currentPeriodEnd: Date;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd: boolean;
  /** When the subscription was created */
  createdAt: Date;
  /** When the subscription was last updated */
  updatedAt: Date;
  /** Trial end date (if trialing) */
  trialEnd?: Date;
  /** Stripe subscription ID (for integration) */
  stripeSubscriptionId?: string;
  /** Stripe customer ID (for integration) */
  stripeCustomerId?: string;
}

/**
 * Subscription data for storage (JSON-serializable)
 */
export interface SubscriptionData {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  planId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  trialEnd?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

/**
 * Payment provider types
 */
export type PaymentProvider = 'stripe' | 'mock';

/**
 * Configuration for subscription service
 */
export interface SubscriptionConfig {
  /** Which payment provider to use */
  provider: PaymentProvider;
  /** Mock delay in ms (for mock provider) */
  mockDelayMs?: number;
  /** Storage key for persisting subscription state */
  storageKey?: string;
  /** Whether to persist subscription state */
  persistSubscription?: boolean;
  /** Default subscription status for mock */
  mockDefaultStatus?: SubscriptionStatus;
  /** Available plans */
  plans?: Plan[];
}

/**
 * Default subscription configuration
 */
export const defaultSubscriptionConfig: SubscriptionConfig = {
  provider: 'mock',
  mockDelayMs: 500,
  storageKey: 'handicap_app_subscription',
  persistSubscription: true,
  mockDefaultStatus: 'none',
  plans: [DEFAULT_PLAN],
};

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Subscription error codes
 */
export type SubscriptionErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'PAYMENT_FAILED'
  | 'INVALID_PLAN'
  | 'ALREADY_SUBSCRIBED'
  | 'CANNOT_CANCEL'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Structured subscription error
 */
export interface SubscriptionError {
  code: SubscriptionErrorCode;
  message: string;
  originalError?: unknown;
}

/**
 * Create a typed subscription error
 */
export function createSubscriptionError(
  code: SubscriptionErrorCode,
  message: string,
  originalError?: unknown
): SubscriptionError {
  return { code, message, originalError };
}

/**
 * Type guard for SubscriptionError
 */
export function isSubscriptionError(error: unknown): error is SubscriptionError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

// ============================================================================
// SERVICE INTERFACE
// ============================================================================

/**
 * Unsubscribe function returned by listeners
 */
export type Unsubscribe = () => void;

/**
 * Subscription state change callback
 */
export type SubscriptionCallback = (subscription: Subscription | null) => void;

/**
 * Checkout session result
 */
export interface CheckoutSession {
  /** Session ID */
  id: string;
  /** Checkout URL to redirect to */
  url: string;
}

/**
 * Portal session result
 */
export interface PortalSession {
  /** Session ID */
  id: string;
  /** Portal URL to redirect to */
  url: string;
}

/**
 * Subscription service interface
 * All payment providers must implement this interface
 */
export interface ISubscriptionService {
  /**
   * Get subscription for a user
   * Returns null if no subscription exists
   */
  getSubscription(userId: string): Promise<Subscription | null>;

  /**
   * Create a checkout session for a plan
   * Returns the checkout URL
   */
  createCheckoutSession(userId: string, planId: string): Promise<string>;

  /**
   * Create a billing portal session for managing subscription
   * Returns the portal URL
   */
  createPortalSession(userId: string): Promise<string>;

  /**
   * Cancel a subscription
   * Sets cancelAtPeriodEnd to true
   */
  cancelSubscription(subscriptionId: string): Promise<void>;

  /**
   * Resume a canceled subscription
   */
  resumeSubscription?(subscriptionId: string): Promise<void>;

  /**
   * Subscribe to subscription changes for a user
   * Returns an unsubscribe function
   */
  onSubscriptionChange(userId: string, callback: SubscriptionCallback): Unsubscribe;

  /**
   * Get available plans
   */
  getPlans(): Plan[];

  /**
   * Check if user has active subscription (convenience method)
   */
  hasActiveSubscription(userId: string): Promise<boolean>;

  /**
   * For mock: Set subscription status for testing
   */
  setMockSubscription?(userId: string, status: SubscriptionStatus): void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert Subscription to SubscriptionData for storage
 */
export function subscriptionToData(subscription: Subscription): SubscriptionData {
  return {
    id: subscription.id,
    userId: subscription.userId,
    status: subscription.status,
    planId: subscription.planId,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
    trialEnd: subscription.trialEnd?.toISOString(),
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripeCustomerId: subscription.stripeCustomerId,
  };
}

/**
 * Convert SubscriptionData to Subscription
 */
export function dataToSubscription(data: SubscriptionData, plan: Plan): Subscription {
  return {
    id: data.id,
    userId: data.userId,
    status: data.status,
    planId: data.planId,
    plan,
    currentPeriodStart: new Date(data.currentPeriodStart),
    currentPeriodEnd: new Date(data.currentPeriodEnd),
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    trialEnd: data.trialEnd ? new Date(data.trialEnd) : undefined,
    stripeSubscriptionId: data.stripeSubscriptionId,
    stripeCustomerId: data.stripeCustomerId,
  };
}

/**
 * Calculate days remaining in subscription period
 */
export function getDaysRemaining(subscription: Subscription | null): number {
  if (!subscription) return 0;
  if (!hasActiveAccess(subscription.status)) return 0;

  const now = new Date();
  const end = subscription.currentPeriodEnd;
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Format subscription status for display
 */
export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'canceled':
      return 'Canceled';
    case 'past_due':
      return 'Past Due';
    case 'trialing':
      return 'Trial';
    case 'none':
      return 'No Subscription';
    default:
      return 'Unknown';
  }
}

/**
 * Get status color for display
 */
export function getStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return '#10b981'; // Success green
    case 'canceled':
      return '#f59e0b'; // Warning yellow
    case 'past_due':
      return '#ef4444'; // Error red
    case 'none':
    default:
      return '#6E6E70'; // Tertiary text
  }
}
