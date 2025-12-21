/**
 * SubscriptionPage Component
 *
 * Full page layout shown to non-subscribers when they try to access gated content.
 * Displays value proposition, PricingCard, and legal links.
 */

import { useState } from 'react';
import { PricingCard } from './PricingCard';
import { LegalModal, type LegalContentType } from '../legal';
import { logger } from '../../services/logging';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionPageProps {
  /** Optional callback after successful subscription initiation */
  onSubscribe?: () => void;
  /** Context text explaining what feature requires subscription */
  context?: string;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    backgroundColor: '#0A0A0B',
    position: 'relative',
  },
  content: {
    maxWidth: '440px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  lockIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
    color: '#19abb5',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#EEEFF1',
    margin: '0 0 8px 0',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '16px',
    color: '#B4B4B6',
    margin: '0 0 4px 0',
    lineHeight: 1.5,
  },
  contextText: {
    fontSize: '14px',
    color: '#6E6E70',
    margin: '16px 0 0 0',
    padding: '12px 16px',
    backgroundColor: '#1A1A1C',
    borderRadius: '8px',
    border: '1px solid #2A2A2C',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  contextIcon: {
    fontSize: '18px',
    color: '#f59e0b',
    flexShrink: 0,
  },
  legalLinks: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '24px',
    flexWrap: 'wrap',
  },
  legalLink: {
    fontSize: '13px',
    color: '#6E6E70',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  legalLinkHover: {
    color: '#B4B4B6',
  },
  legalDivider: {
    color: '#3A3A3C',
    fontSize: '13px',
  },
  benefitsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    justifyContent: 'center',
    marginBottom: '32px',
    width: '100%',
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#B4B4B6',
    backgroundColor: '#1A1A1C',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #2A2A2C',
  },
  benefitIcon: {
    fontSize: '16px',
    color: '#10b981',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * SubscriptionPage is the full-page paywall shown to non-subscribers.
 *
 * @example
 * ```tsx
 * <SubscriptionPage
 *   context="Access to full race analysis"
 *   onSubscribe={() => refetchUser()}
 * />
 * ```
 */
export function SubscriptionPage({ onSubscribe, context }: SubscriptionPageProps) {
  const [legalModalType, setLegalModalType] = useState<LegalContentType | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const handleOpenLegal = (type: LegalContentType) => {
    logger.logInfo('Opening legal modal from subscription page', {
      component: 'SubscriptionPage',
      type,
    });
    setLegalModalType(type);
  };

  const handleCloseLegal = () => {
    setLegalModalType(null);
  };

  const getLegalLinkStyle = (linkType: string) => ({
    ...styles.legalLink,
    ...(hoveredLink === linkType ? styles.legalLinkHover : {}),
  });

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <div style={styles.lockIcon}>
            <span className="material-icons" style={{ fontSize: '32px' }}>
              workspace_premium
            </span>
          </div>

          <h1 style={styles.title}>Unlock Pro Features</h1>
          <p style={styles.subtitle}>Professional-grade horse racing analysis at your fingertips</p>

          {context && (
            <div style={styles.contextText}>
              <span className="material-icons" style={styles.contextIcon}>
                info
              </span>
              {context}
            </div>
          )}
        </div>

        <div style={styles.benefitsList}>
          <div style={styles.benefitItem}>
            <span className="material-icons" style={styles.benefitIcon}>
              check_circle
            </span>
            No contracts
          </div>
          <div style={styles.benefitItem}>
            <span className="material-icons" style={styles.benefitIcon}>
              check_circle
            </span>
            Cancel anytime
          </div>
          <div style={styles.benefitItem}>
            <span className="material-icons" style={styles.benefitIcon}>
              check_circle
            </span>
            Works offline
          </div>
        </div>

        <PricingCard onSubscribe={onSubscribe} />

        <div style={styles.legalLinks}>
          <button
            type="button"
            style={getLegalLinkStyle('terms')}
            onClick={() => handleOpenLegal('terms')}
            onMouseEnter={() => setHoveredLink('terms')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            Terms of Service
          </button>
          <span style={styles.legalDivider}>|</span>
          <button
            type="button"
            style={getLegalLinkStyle('privacy')}
            onClick={() => handleOpenLegal('privacy')}
            onMouseEnter={() => setHoveredLink('privacy')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            Privacy Policy
          </button>
          <span style={styles.legalDivider}>|</span>
          <button
            type="button"
            style={getLegalLinkStyle('disclaimer')}
            onClick={() => handleOpenLegal('disclaimer')}
            onMouseEnter={() => setHoveredLink('disclaimer')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            Disclaimer
          </button>
        </div>
      </div>

      {legalModalType && (
        <LegalModal type={legalModalType} isOpen={true} onClose={handleCloseLegal} />
      )}
    </div>
  );
}

export default SubscriptionPage;
