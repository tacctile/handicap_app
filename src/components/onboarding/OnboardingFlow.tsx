import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OnboardingStep } from './OnboardingStep';
import { FileUpload } from '../FileUpload';
import type { ParsedDRFFile } from '../../types/drf';

interface OnboardingFlowProps {
  onComplete: () => void;
  onFileUploaded: (data: ParsedDRFFile) => void;
}

const TOTAL_STEPS = 3;

/**
 * Onboarding flow for new users
 * Step 1: Welcome screen with app value proposition
 * Step 2: How it works (upload → analyze → bet)
 * Step 3: Prompt to upload first DRF file
 */
export function OnboardingFlow({ onComplete, onFileUploaded }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleFileUploaded = useCallback(
    (data: ParsedDRFFile) => {
      onFileUploaded(data);
      onComplete();
    },
    [onFileUploaded, onComplete]
  );

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {/* Progress indicator */}
        <div className="onboarding-progress">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`onboarding-progress-dot ${
                i + 1 === currentStep ? 'active' : i + 1 < currentStep ? 'completed' : ''
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <OnboardingStep
              key="step-1"
              title="Welcome to Furlong"
              description="Professional-grade horse racing analysis at your fingertips."
              onNext={handleNext}
              onSkip={handleSkip}
            >
              <ul className="onboarding-value-list">
                <li>
                  <span className="material-icons">analytics</span>
                  <span>Data-driven betting recommendations</span>
                </li>
                <li>
                  <span className="material-icons">offline_bolt</span>
                  <span>Works offline at the track</span>
                </li>
                <li>
                  <span className="material-icons">verified</span>
                  <span>Proven mathematical scoring system</span>
                </li>
              </ul>
            </OnboardingStep>
          )}

          {currentStep === 2 && (
            <OnboardingStep
              key="step-2"
              title="How It Works"
              description="Three simple steps to better handicapping."
              onNext={handleNext}
              onSkip={handleSkip}
            >
              <div className="onboarding-how-it-works">
                <div className="onboarding-step-item">
                  <div className="onboarding-step-number">1</div>
                  <div className="onboarding-step-info">
                    <h4>Upload</h4>
                    <p>Drop your DRF file into the app</p>
                  </div>
                </div>
                <div className="onboarding-step-arrow">
                  <span className="material-icons">arrow_forward</span>
                </div>
                <div className="onboarding-step-item">
                  <div className="onboarding-step-number">2</div>
                  <div className="onboarding-step-info">
                    <h4>Analyze</h4>
                    <p>Our algorithm scores every horse</p>
                  </div>
                </div>
                <div className="onboarding-step-arrow">
                  <span className="material-icons">arrow_forward</span>
                </div>
                <div className="onboarding-step-item">
                  <div className="onboarding-step-number">3</div>
                  <div className="onboarding-step-info">
                    <h4>Bet</h4>
                    <p>Get tiered betting recommendations</p>
                  </div>
                </div>
              </div>
            </OnboardingStep>
          )}

          {currentStep === 3 && (
            <OnboardingStep
              key="step-3"
              title="Upload Your First File"
              description="Get started by uploading a DRF file to see the analysis in action."
              onSkip={handleSkip}
              showNext={false}
              skipLabel="Skip for now"
            >
              <div className="onboarding-upload-wrapper">
                <FileUpload onParsed={handleFileUploaded} />
              </div>
            </OnboardingStep>
          )}
        </AnimatePresence>
      </div>

      {/* Background decoration */}
      <motion.div
        className="onboarding-bg-gradient"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}
