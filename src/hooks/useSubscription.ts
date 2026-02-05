/**
 * useSubscription Hook (Stub)
 *
 * Minimal stub that bypasses subscription checks.
 * Subscription features have been removed from the application.
 */

// Inline types (previously from services/payments/types)
type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';

type BillingInterval = 'month' | 'year';

interface Plan {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  priceFormatted: string;
  interval: BillingInterval;
  currency: string;
  features: string[];
  isRecommended?: boolean;
  stripePriceId?: string;
}

interface Subscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  planId: string;
  plan: Plan;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  trialEnd?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}

type SubscriptionErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'PAYMENT_FAILED'
  | 'INVALID_PLAN'
  | 'ALREADY_SUBSCRIBED'
  | 'CANNOT_CANCEL'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN_ERROR';

interface SubscriptionError {
  code: SubscriptionErrorCode;
  message: string;
  originalError?: unknown;
}

const DEFAULT_PLAN: Plan = {
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

export interface SubscriptionState {
  isActive: boolean;
  isLoading: boolean;
  isCanceling: boolean;
  status: SubscriptionStatus;
  daysRemaining: number;
  subscription: Subscription | null;
  error: SubscriptionError | null;
  openCheckout: (plan?: string) => Promise<string>;
  cancel: () => Promise<void>;
  resume: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// Create a stub subscription that's always active
const stubSubscription: Subscription = {
  id: 'stub-subscription',
  userId: 'stub-user',
  status: 'active',
  planId: 'pro',
  plan: DEFAULT_PLAN,
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Stub hook that returns "always subscribed" state.
 * Subscription functionality has been removed from this application.
 */
export function useSubscription(): SubscriptionState {
  return {
    isActive: true,
    isLoading: false,
    isCanceling: false,
    status: 'active',
    daysRemaining: 999,
    subscription: stubSubscription,
    error: null,
    openCheckout: async () => '',
    cancel: async () => {},
    resume: async () => {},
    refresh: async () => {},
    clearError: () => {},
  };
}

export default useSubscription;
