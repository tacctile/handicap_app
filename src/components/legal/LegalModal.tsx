import { useEffect, useCallback, useRef } from 'react';
import { DISCLAIMER_TEXT, TERMS_OF_SERVICE, PRIVACY_POLICY } from '../../legal';
import { logger } from '../../services/logging';

export type LegalContentType = 'disclaimer' | 'terms' | 'privacy';

interface LegalModalProps {
  /** Type of legal content to display */
  type: LegalContentType;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
}

const LEGAL_CONTENT: Record<LegalContentType, { title: string; content: string }> = {
  disclaimer: {
    title: 'Disclaimer',
    content: DISCLAIMER_TEXT,
  },
  terms: {
    title: 'Terms of Service',
    content: TERMS_OF_SERVICE,
  },
  privacy: {
    title: 'Privacy Policy',
    content: PRIVACY_POLICY,
  },
};

/**
 * LegalModal Component
 *
 * Reusable modal for displaying full legal text content.
 * Supports disclaimer, terms of service, and privacy policy.
 */
export function LegalModal({ type, isOpen, onClose }: LegalModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { title, content } = LEGAL_CONTENT[type];

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        logger.logInfo('Legal modal closed via Escape key', {
          component: 'LegalModal',
          type,
        });
        onClose();
      }
    },
    [onClose, type]
  );

  // Handle click outside
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        logger.logInfo('Legal modal closed via overlay click', {
          component: 'LegalModal',
          type,
        });
        onClose();
      }
    },
    [onClose, type]
  );

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      logger.logInfo('Legal modal opened', {
        component: 'LegalModal',
        type,
      });

      // Focus the modal for accessibility
      modalRef.current?.focus();

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown, type]);

  // Scroll to top when content changes
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isOpen, type]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="legal-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div ref={modalRef} className="legal-modal" tabIndex={-1}>
        {/* Header */}
        <div className="legal-modal-header">
          <h2 id="legal-modal-title" className="legal-modal-title">
            <span className="material-icons legal-modal-icon">description</span>
            {title}
          </h2>
          <button
            type="button"
            className="legal-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div ref={contentRef} className="legal-modal-content">
          <pre className="legal-modal-text">{content}</pre>
        </div>

        {/* Footer */}
        <div className="legal-modal-footer">
          <button type="button" className="legal-modal-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
