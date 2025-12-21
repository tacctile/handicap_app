/**
 * Kelly Criterion Help Modal
 *
 * Displays educational content about the Kelly Criterion
 * for users who want to learn more about optimal bet sizing.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { KELLY_EDUCATION } from '../lib/betting/kellySettings';

interface KellyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KellyHelpModal({ isOpen, onClose }: KellyHelpModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="kelly-help-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="kelly-help-modal-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="kelly-help-modal"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {/* Header */}
              <div className="kelly-help-header">
                <div className="kelly-help-title-group">
                  <span className="material-icons kelly-help-icon">functions</span>
                  <h2 className="kelly-help-title">{KELLY_EDUCATION.title}</h2>
                </div>
                <button className="kelly-help-close" onClick={onClose} aria-label="Close help">
                  <span className="material-icons">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="kelly-help-content">
                {/* Overview */}
                <section className="kelly-help-section">
                  <h3 className="kelly-help-section-title">
                    <span className="material-icons">info</span>
                    What is Kelly Criterion?
                  </h3>
                  <p className="kelly-help-text">{KELLY_EDUCATION.overview}</p>
                </section>

                {/* Formula */}
                <section className="kelly-help-section">
                  <h3 className="kelly-help-section-title">
                    <span className="material-icons">calculate</span>
                    The Formula
                  </h3>
                  <pre className="kelly-help-code">{KELLY_EDUCATION.formula}</pre>
                </section>

                {/* Example */}
                <section className="kelly-help-section">
                  <h3 className="kelly-help-section-title">
                    <span className="material-icons">school</span>
                    Example Calculation
                  </h3>
                  <pre className="kelly-help-code kelly-help-example">
                    {KELLY_EDUCATION.example}
                  </pre>
                </section>

                {/* Fractional Kelly */}
                <section className="kelly-help-section">
                  <h3 className="kelly-help-section-title">
                    <span className="material-icons">pie_chart</span>
                    Why Fractional Kelly?
                  </h3>
                  <p className="kelly-help-text">{KELLY_EDUCATION.whyFractional}</p>
                </section>

                {/* Warnings */}
                <section className="kelly-help-section">
                  <h3 className="kelly-help-section-title">
                    <span className="material-icons">warning</span>
                    Important Warnings
                  </h3>
                  <ul className="kelly-help-warnings">
                    {KELLY_EDUCATION.warnings.map((warning, index) => (
                      <li key={index} className="kelly-help-warning-item">
                        <span className="material-icons">error_outline</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Glossary */}
                <section className="kelly-help-section">
                  <h3 className="kelly-help-section-title">
                    <span className="material-icons">menu_book</span>
                    Glossary
                  </h3>
                  <dl className="kelly-help-glossary">
                    {Object.entries(KELLY_EDUCATION.glossary).map(([term, definition]) => (
                      <div key={term} className="kelly-help-glossary-item">
                        <dt className="kelly-help-term">{term.replace(/_/g, ' ')}</dt>
                        <dd className="kelly-help-definition">{definition}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>

              {/* Footer */}
              <div className="kelly-help-footer">
                <button className="kelly-help-close-btn" onClick={onClose}>
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default KellyHelpModal;
