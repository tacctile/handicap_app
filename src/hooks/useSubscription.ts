/**
 * useSubscription Hook (Stub)
 *
 * Minimal stub that bypasses subscription checks.
 * Subscription features have been removed from the application.
 */

import type {
  Subscription,
  SubscriptionStatus,
  SubscriptionError,
} from '../services/payments/types';
import { DEFAULT_PLAN } from '../services/payments/types';

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
