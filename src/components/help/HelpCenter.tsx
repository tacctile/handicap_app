import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FAQAccordion } from './FAQAccordion'
import { GuideSection } from './GuideSection'
import { FAQ_ITEMS } from '../../help/faq'
import { GUIDE_SECTIONS } from '../../help/guides'
import { logger } from '../../services/logging'

type TabType = 'faq' | 'guides'

interface HelpCenterProps {
  onBack: () => void
}

/**
 * HelpCenter Component
 *
 * Main help center with tabbed navigation between FAQ and Guides.
 * Provides comprehensive documentation and answers to common questions.
 */
export function HelpCenter({ onBack }: HelpCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('faq')
  const [selectedGuide, setSelectedGuide] = useState<string>(GUIDE_SECTIONS[0]?.id ?? '')

  // Log help center access
  useEffect(() => {
    logger.logInfo('Help Center opened', {
      component: 'HelpCenter',
    })
  }, [])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    logger.logInfo('Help Center tab changed', {
      component: 'HelpCenter',
      tab,
    })
  }, [])

  const handleGuideSelect = useCallback((guideId: string) => {
    setSelectedGuide(guideId)
    logger.logInfo('Guide section selected', {
      component: 'HelpCenter',
      guideId,
    })
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack()
      }
    },
    [onBack]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const selectedGuideSection = GUIDE_SECTIONS.find((g) => g.id === selectedGuide) ?? GUIDE_SECTIONS[0]

  return (
    <div className="help-center">
      {/* Header */}
      <header className="help-center-header">
        <button className="help-center-back" onClick={onBack} aria-label="Go back">
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="help-center-title-section">
          <h1 className="help-center-title">
            <span className="material-icons help-center-title-icon">help_outline</span>
            Help Center
          </h1>
          <p className="help-center-subtitle">Find answers and learn how to use Furlong</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="help-center-tabs" role="tablist">
        <button
          className={`help-center-tab ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => handleTabChange('faq')}
          role="tab"
          aria-selected={activeTab === 'faq'}
          aria-controls="help-panel-faq"
        >
          <span className="material-icons help-center-tab-icon">quiz</span>
          <span className="help-center-tab-label">FAQ</span>
          <span className="help-center-tab-count">{FAQ_ITEMS.length}</span>
        </button>
        <button
          className={`help-center-tab ${activeTab === 'guides' ? 'active' : ''}`}
          onClick={() => handleTabChange('guides')}
          role="tab"
          aria-selected={activeTab === 'guides'}
          aria-controls="help-panel-guides"
        >
          <span className="material-icons help-center-tab-icon">menu_book</span>
          <span className="help-center-tab-label">Guides</span>
          <span className="help-center-tab-count">{GUIDE_SECTIONS.length}</span>
        </button>
      </nav>

      {/* Tab Content */}
      <div className="help-center-content">
        {activeTab === 'faq' && (
          <motion.div
            id="help-panel-faq"
            role="tabpanel"
            aria-labelledby="tab-faq"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="help-center-panel"
          >
            <div className="help-faq-container">
              <FAQAccordion items={FAQ_ITEMS} />
            </div>
          </motion.div>
        )}

        {activeTab === 'guides' && (
          <motion.div
            id="help-panel-guides"
            role="tabpanel"
            aria-labelledby="tab-guides"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="help-center-panel help-guides-panel"
          >
            {/* Guide Navigation */}
            <nav className="help-guides-nav">
              {GUIDE_SECTIONS.map((guide) => (
                <button
                  key={guide.id}
                  className={`help-guides-nav-item ${selectedGuide === guide.id ? 'active' : ''}`}
                  onClick={() => handleGuideSelect(guide.id)}
                >
                  <span className="material-icons help-guides-nav-icon">{guide.icon}</span>
                  <span className="help-guides-nav-label">{guide.title}</span>
                </button>
              ))}
            </nav>

            {/* Guide Content */}
            <div className="help-guides-content">
              {selectedGuideSection && <GuideSection section={selectedGuideSection} />}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default HelpCenter
