import { useCallback } from 'react'
import type { LegalContentType } from '../legal'
import { logger } from '../../services/logging'

interface FooterProps {
  /** Callback when a legal link is clicked */
  onOpenLegalModal: (type: LegalContentType) => void
}

/**
 * Footer Component
 *
 * Minimal footer with copyright and legal links.
 * Links open LegalModal with appropriate content type.
 */
export function Footer({ onOpenLegalModal }: FooterProps) {
  const currentYear = new Date().getFullYear()

  const handleLegalClick = useCallback(
    (type: LegalContentType) => {
      logger.logInfo('Legal link clicked from footer', {
        component: 'Footer',
        legalType: type,
      })
      onOpenLegalModal(type)
    },
    [onOpenLegalModal]
  )

  return (
    <footer className="app-footer">
      <div className="app-footer-content">
        {/* Copyright */}
        <span className="app-footer-copyright">
          &copy; {currentYear} Furlong. All rights reserved.
        </span>

        {/* Divider */}
        <span className="app-footer-divider" aria-hidden="true">
          &bull;
        </span>

        {/* Legal Links */}
        <nav className="app-footer-legal" aria-label="Legal links">
          <button
            type="button"
            className="app-footer-link"
            onClick={() => handleLegalClick('terms')}
          >
            Terms of Service
          </button>
          <button
            type="button"
            className="app-footer-link"
            onClick={() => handleLegalClick('privacy')}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            className="app-footer-link"
            onClick={() => handleLegalClick('disclaimer')}
          >
            Disclaimer
          </button>
        </nav>
      </div>
    </footer>
  )
}

export default Footer
