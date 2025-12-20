import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  trackDbLoaded?: boolean
}

interface NavItem {
  id: string
  label: string
  icon: string
  active?: boolean
  disabled?: boolean
  badge?: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', active: true },
  { id: 'settings', label: 'Settings', icon: 'settings', disabled: true },
  { id: 'help', label: 'Help Center', icon: 'help_outline', disabled: true },
  { id: 'signout', label: 'Sign Out', icon: 'logout', disabled: true },
]

const VERSION = 'v2.0.0'

export function Sidebar({ isOpen, onToggle, trackDbLoaded = true }: SidebarProps) {
  const [activeItem, setActiveItem] = useState('dashboard')

  // Close sidebar on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onToggle])

  const sidebarVariants = {
    open: {
      x: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
    },
    closed: {
      x: '-100%',
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
    },
  }

  const overlayVariants = {
    open: { opacity: 1 },
    closed: { opacity: 0 },
  }

  const handleNavClick = (item: NavItem) => {
    if (!item.disabled) {
      setActiveItem(item.id)
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sidebar-overlay"
            variants={overlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={onToggle}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar - always visible */}
      <aside className="sidebar-desktop" aria-label="Main navigation">
        <SidebarContent
          activeItem={activeItem}
          onNavClick={handleNavClick}
          trackDbLoaded={trackDbLoaded}
        />
      </aside>

      {/* Mobile sidebar - slide in */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className="sidebar-mobile"
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
            aria-label="Main navigation"
          >
            <div className="sidebar-mobile-header">
              <button
                className="sidebar-close-btn"
                onClick={onToggle}
                aria-label="Close navigation"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <SidebarContent
              activeItem={activeItem}
              onNavClick={handleNavClick}
              trackDbLoaded={trackDbLoaded}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

interface SidebarContentProps {
  activeItem: string
  onNavClick: (item: NavItem) => void
  trackDbLoaded: boolean
}

function SidebarContent({ activeItem, onNavClick, trackDbLoaded }: SidebarContentProps) {
  return (
    <div className="sidebar-content">
      {/* Logo section */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span className="material-icons">casino</span>
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">Horse Monster</span>
          <span className="sidebar-logo-tagline">Pro Handicapping</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" role="navigation">
        <ul className="sidebar-nav-list">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                className={`sidebar-nav-item ${activeItem === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                onClick={() => onNavClick(item)}
                disabled={item.disabled}
                aria-current={activeItem === item.id ? 'page' : undefined}
              >
                <span className="material-icons sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-label">{item.label}</span>
                {item.disabled && (
                  <span className="sidebar-nav-badge">Soon</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Divider */}
      <div className="sidebar-divider" />

      {/* Status section */}
      <div className="sidebar-status">
        <div className="sidebar-status-item">
          <div className={`sidebar-status-dot ${trackDbLoaded ? 'active' : ''}`} />
          <span className="sidebar-status-label">
            {trackDbLoaded ? 'Track DB Loaded' : 'Track DB Offline'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="sidebar-version">{VERSION}</span>
        <span className="sidebar-copyright">Powered by AI Analytics</span>
      </div>
    </div>
  )
}

export default Sidebar
