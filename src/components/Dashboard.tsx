import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar, TopBar, MobileNav } from './layout'
import { RaceOverviewCard, EmptyStateTable, BettingPanel } from './cards'
import { FileUpload } from './FileUpload'
import { RaceTable } from './RaceTable'
import { LoadingState } from './LoadingState'
import { DataValidationWarning } from './ErrorBoundary'
import { StaggerContainer, StaggerItem, FadeIn } from './motion'
import { BankrollSettings } from './BankrollSettings'
import { BankrollSummaryCard } from './BankrollSummaryCard'
import { useBankroll } from '../hooks/useBankroll'
import type { useRaceState } from '../hooks/useRaceState'
import type { ParsedDRFFile } from '../types/drf'

interface DashboardProps {
  parsedData: ParsedDRFFile | null
  isLoading: boolean
  validationWarnings: string[]
  showWarnings: boolean
  onParsed: (data: ParsedDRFFile) => void
  onDismissWarnings: () => void
  raceState: ReturnType<typeof useRaceState>
}

export function Dashboard({
  parsedData,
  isLoading,
  validationWarnings,
  showWarnings,
  onParsed,
  onDismissWarnings,
  raceState,
}: DashboardProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'dashboard' | 'upload' | 'settings'>('dashboard')
  const [selectedRaceIndex] = useState(0)
  const [bankrollSettingsOpen, setBankrollSettingsOpen] = useState(false)

  // Bankroll management hook
  const bankroll = useBankroll()

  const hasData = !!parsedData && parsedData.races.length > 0

  // Open bankroll settings modal
  const openBankrollSettings = useCallback(() => {
    setBankrollSettingsOpen(true)
  }, [])

  // Close bankroll settings modal
  const closeBankrollSettings = useCallback(() => {
    setBankrollSettingsOpen(false)
  }, [])

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  // Handle file upload click
  const handleUploadClick = useCallback(() => {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.click()
    }
  }, [])

  // Handle mobile tab change
  const handleMobileTabChange = useCallback((tab: 'dashboard' | 'upload' | 'settings') => {
    setMobileTab(tab)
    if (tab === 'upload') {
      handleUploadClick()
    }
  }, [handleUploadClick])

  // Get current race info for top bar
  const currentRaceInfo = useMemo(() => {
    if (!parsedData || !parsedData.races.length) return undefined

    const race = parsedData.races[selectedRaceIndex]
    return {
      trackName: race?.header?.trackCode || 'Unknown Track',
      raceNumber: race?.header?.raceNumber || selectedRaceIndex + 1,
    }
  }, [parsedData, selectedRaceIndex])

  // Get race overview data
  const raceOverviewData = useMemo(() => {
    if (!parsedData || !parsedData.races.length) return undefined

    const race = parsedData.races[selectedRaceIndex]
    return {
      trackName: race?.header?.trackCode || 'Unknown Track',
      raceNumber: race?.header?.raceNumber || selectedRaceIndex + 1,
      distance: race?.header?.distance || undefined,
      surface: race?.header?.surface || undefined,
      conditions: raceState.trackCondition,
    }
  }, [parsedData, selectedRaceIndex, raceState.trackCondition])

  // Mock betting recommendations (would come from actual betting logic)
  const bettingRecommendations = useMemo(() => {
    if (!hasData) return undefined

    // This would integrate with actual betting recommendation logic
    return {
      tier1: { horses: [], confidence: 0 },
      tier2: { horses: [], confidence: 0 },
      tier3: { horses: [], confidence: 0 },
    }
  }, [hasData])

  // Calculate stats
  const stats = useMemo(() => {
    if (!parsedData) return { races: 0, horses: 0 }
    return {
      races: parsedData.races.length,
      horses: parsedData.races.reduce((sum, race) => sum + race.horses.length, 0),
    }
  }, [parsedData])

  return (
    <div className="dashboard">
      {/* Skip to content link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        trackDbLoaded={true}
      />

      {/* Main container */}
      <div className="dashboard-main">
        {/* Top bar */}
        <TopBar
          currentRace={currentRaceInfo}
          onUploadClick={handleUploadClick}
          onMenuClick={toggleSidebar}
          onSettingsClick={openBankrollSettings}
          hasData={hasData}
          bankroll={bankroll}
          onOpenBankrollSettings={openBankrollSettings}
        />

        {/* Hidden file upload */}
        <div className="sr-only">
          <FileUpload onParsed={onParsed} />
        </div>

        {/* Main content */}
        <main id="main-content" className="dashboard-content">
          {/* Loading state */}
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="dashboard-loading"
              >
                <LoadingState message="Analyzing race data..." />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation warnings */}
          {parsedData && showWarnings && validationWarnings.length > 0 && (
            <FadeIn className="dashboard-warnings">
              <DataValidationWarning
                warnings={validationWarnings}
                onDismiss={onDismissWarnings}
              />
            </FadeIn>
          )}

          {/* Three-column layout */}
          <div className="dashboard-grid">
            {/* LEFT COLUMN - Race Overview */}
            <aside className="dashboard-column left" aria-label="Race overview">
              <RaceOverviewCard
                race={raceOverviewData}
                weather={{ temp: 72, condition: 'sunny' }}
                isLoading={isLoading}
              />

              {/* Stats summary when data is loaded */}
              {hasData && (
                <FadeIn delay={0.2}>
                  <div className="dashboard-stats-card">
                    <div className="stats-header">
                      <span className="material-icons">bar_chart</span>
                      <span>Session Stats</span>
                    </div>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-value">{stats.races}</span>
                        <span className="stat-label">Races</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.horses}</span>
                        <span className="stat-label">Horses</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{parsedData?.filename?.split('.')[0].slice(0, 8) || '—'}</span>
                        <span className="stat-label">File</span>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* Performance tracking placeholder */}
              <FadeIn delay={0.3}>
                <div className="dashboard-placeholder-card">
                  <div className="placeholder-header">
                    <span className="material-icons">trending_up</span>
                    <span>Performance Tracking</span>
                    <span className="placeholder-badge">Coming Soon</span>
                  </div>
                  <div className="placeholder-content">
                    <div className="placeholder-line" style={{ width: '80%' }} />
                    <div className="placeholder-line" style={{ width: '60%' }} />
                    <div className="placeholder-line" style={{ width: '70%' }} />
                  </div>
                </div>
              </FadeIn>
            </aside>

            {/* CENTER COLUMN - Horse Analysis Table */}
            <section className="dashboard-column center" aria-label="Horse analysis">
              <AnimatePresence mode="wait">
                {!hasData ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <EmptyStateTable
                      onUploadClick={handleUploadClick}
                      isLoading={isLoading}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="data"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="race-tables-container"
                  >
                    <StaggerContainer>
                      {parsedData.races.map((race, index) => (
                        <StaggerItem key={index}>
                          <RaceTable
                            race={race}
                            raceState={raceState}
                            bankroll={bankroll}
                            onOpenBankrollSettings={openBankrollSettings}
                          />
                        </StaggerItem>
                      ))}
                    </StaggerContainer>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* RIGHT COLUMN - Betting Recommendations */}
            <aside className="dashboard-column right" aria-label="Betting recommendations">
              {/* Bankroll Summary Card - Mobile collapsible */}
              <div className="bankroll-summary-mobile-wrapper">
                <BankrollSummaryCard
                  bankroll={bankroll}
                  onOpenSettings={openBankrollSettings}
                  variant="mobile"
                />
              </div>

              {/* Bankroll Summary Card - Desktop full version */}
              <div className="bankroll-summary-desktop-wrapper">
                <BankrollSummaryCard
                  bankroll={bankroll}
                  onOpenSettings={openBankrollSettings}
                  variant="full"
                />
              </div>

              <BettingPanel
                recommendations={bettingRecommendations}
                overallConfidence={hasData ? 0 : 0}
                isLoading={isLoading}
              />
            </aside>
          </div>

          {/* Detailed analysis expansion panel */}
          <FadeIn delay={0.4}>
            <div className="dashboard-expansion-panel">
              <button className="expansion-panel-header" disabled>
                <div className="expansion-panel-title">
                  <span className="material-icons">insights</span>
                  <span>Detailed Analysis</span>
                  <span className="expansion-coming-soon">Coming Soon</span>
                </div>
                <span className="material-icons expansion-arrow">expand_more</span>
              </button>
            </div>
          </FadeIn>

          {/* API Access section - enterprise placeholder */}
          <FadeIn delay={0.5}>
            <div className="dashboard-enterprise-section">
              <div className="enterprise-card">
                <div className="enterprise-header">
                  <span className="material-icons">api</span>
                  <span>API Access</span>
                  <span className="enterprise-badge">Enterprise</span>
                </div>
                <p className="enterprise-description">
                  Integrate Horse Monster analytics into your applications with our REST API.
                </p>
                <button className="enterprise-btn" disabled>
                  Learn More
                </button>
              </div>
            </div>
          </FadeIn>
        </main>

        {/* Footer */}
        <footer className="dashboard-footer">
          <div className="footer-content">
            <span className="footer-powered">Powered by Advanced AI Analytics</span>
            <span className="footer-divider">•</span>
            <span className="footer-version">Algorithm v2.0</span>
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav
        activeTab={mobileTab}
        onTabChange={handleMobileTabChange}
        hasData={hasData}
      />

      {/* Bankroll Settings Modal */}
      <BankrollSettings
        isOpen={bankrollSettingsOpen}
        onClose={closeBankrollSettings}
        settings={bankroll.settings}
        onSave={bankroll.updateSettings}
        onReset={bankroll.resetToDefaults}
        dailyPL={bankroll.dailyPL}
        spentToday={bankroll.getSpentToday()}
        dailyBudget={bankroll.getDailyBudget()}
      />
    </div>
  )
}

export default Dashboard
