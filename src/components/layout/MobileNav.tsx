import { motion } from 'framer-motion'

interface MobileNavProps {
  activeTab: 'dashboard' | 'upload' | 'settings'
  onTabChange: (tab: 'dashboard' | 'upload' | 'settings') => void
  hasData: boolean
}

interface NavTab {
  id: 'dashboard' | 'upload' | 'settings'
  icon: string
  label: string
  highlight?: boolean
}

export function MobileNav({ activeTab, onTabChange, hasData }: MobileNavProps) {
  const tabs: NavTab[] = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'upload', icon: 'upload_file', label: 'Upload', highlight: !hasData },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ]

  return (
    <nav className="mobile-nav" role="navigation" aria-label="Mobile navigation">
      <div className="mobile-nav-content">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`mobile-nav-item ${activeTab === tab.id ? 'active' : ''} ${tab.highlight ? 'highlight' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {activeTab === tab.id && (
              <motion.div
                className="mobile-nav-indicator"
                layoutId="mobileNavIndicator"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="material-icons mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
            {tab.highlight && (
              <motion.span
                className="mobile-nav-pulse"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}

export default MobileNav
