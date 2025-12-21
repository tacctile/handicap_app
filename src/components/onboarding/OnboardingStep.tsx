import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface OnboardingStepProps {
  title: string;
  description: string;
  children?: ReactNode;
  onNext?: () => void;
  onSkip: () => void;
  showNext?: boolean;
  nextLabel?: string;
  skipLabel?: string;
}

/**
 * Reusable step container for onboarding flow
 * Provides consistent styling with title, description, content slot, and navigation buttons
 */
export function OnboardingStep({
  title,
  description,
  children,
  onNext,
  onSkip,
  showNext = true,
  nextLabel = 'Next',
  skipLabel = 'Skip',
}: OnboardingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="onboarding-step"
    >
      <div className="onboarding-step-content">
        <h2 className="onboarding-step-title">{title}</h2>
        <p className="onboarding-step-description">{description}</p>

        {children && <div className="onboarding-step-body">{children}</div>}
      </div>

      <div className="onboarding-step-actions">
        <button onClick={onSkip} className="onboarding-btn onboarding-btn-skip" type="button">
          {skipLabel}
        </button>

        {showNext && onNext && (
          <button onClick={onNext} className="onboarding-btn onboarding-btn-next" type="button">
            {nextLabel}
            <span className="material-icons">arrow_forward</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
