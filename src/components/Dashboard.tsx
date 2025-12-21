import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar, TopBar, MobileNav, Footer, RaceTabsBar, BettingDrawer, StatusBar } from './layout';
import type { LegalContentType } from './legal';
import { EmptyStateTable } from './cards';
import { FileUpload } from './FileUpload';
import { RaceOverview } from './RaceOverview';
import { RaceDetail } from './RaceDetail';
import { LoadingState } from './LoadingState';
import { DataValidationWarning } from './ErrorBoundary';
import { FadeIn } from './motion';
import { BankrollSettings } from './BankrollSettings';
import { BankrollSummaryCard } from './BankrollSummaryCard';
import { BettingRecommendations } from './BettingRecommendations';
import { PostTimeDetailModal } from './PostTimeCountdown';
import { useToastContext } from '../contexts/ToastContext';
import { OfflineIndicator } from './OfflineIndicator';
import { InstallPrompt } from './InstallPrompt';
import { UpdatePrompt } from './UpdatePrompt';
import { OnboardingFlow } from './onboarding';
import { useBankroll } from '../hooks/useBankroll';
import { usePostTime } from '../hooks/usePostTime';
import { useOnboarding } from '../hooks/useOnboarding';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  calculateRaceScores,
  calculateRaceConfidence,
  getTopHorses,
  type ScoredHorse,
} from '../lib/scoring';
import type { useRaceState } from '../hooks/useRaceState';
import type { ParsedDRFFile } from '../types/drf';

// View types for overview-first navigation
type ViewMode = 'overview' | 'detail';

interface DashboardProps {
  parsedData: ParsedDRFFile | null;
  isLoading: boolean;
  validationWarnings: string[];
  showWarnings: boolean;
  onParsed: (data: ParsedDRFFile) => void;
  onDismissWarnings: () => void;
  raceState: ReturnType<typeof useRaceState>;
  onOpenLegalModal: (type: LegalContentType) => void;
  onNavigateToAccount?: () => void;
  onNavigateToHelp?: () => void;
}

export function Dashboard({
  parsedData,
  isLoading,
  validationWarnings,
  showWarnings,
  onParsed,
  onDismissWarnings,
  raceState,
  onOpenLegalModal,
  onNavigateToAccount,
  onNavigateToHelp,
}: DashboardProps) {
  // View management state
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [selectedRaceIndex, setSelectedRaceIndex] = useState(0);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'dashboard' | 'upload' | 'settings'>('dashboard');
  const [bankrollSettingsOpen, setBankrollSettingsOpen] = useState(false);
  const [postTimeDetailOpen, setPostTimeDetailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Bankroll management hook
  const bankroll = useBankroll();

  // Onboarding hook
  const { isOnboardingComplete, completeOnboarding } = useOnboarding();

  // Online/offline status hook
  const { isOffline } = useOnlineStatus();

  // Toast notifications (from context - container rendered by ToastProvider)
  const { addPostTimeNotification } = useToastContext();

  const hasData = !!parsedData && parsedData.races.length > 0;

  // Reset to overview when new file is loaded
  useEffect(() => {
    if (parsedData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state when new data is loaded
      setCurrentView('overview');
      setSelectedRaceIndex(0);
    }
  }, [parsedData]);

  // Calculate and cache all race confidences and top horses on data load
  // This is computed once and cached - performance optimization
  const { raceConfidences, topHorsesByRace } = useMemo(() => {
    const confidences = new Map<number, number>();
    const topHorses = new Map<number, ScoredHorse[]>();

    if (!parsedData) {
      return { raceConfidences: confidences, topHorsesByRace: topHorses };
    }

    parsedData.races.forEach((race, index) => {
      // Calculate scores for overview display
      // For overview, we don't use user scratches - show base confidence
      const scoredHorses = calculateRaceScores(
        race.horses,
        race.header,
        (_i, originalOdds) => originalOdds, // Use original odds for overview
        () => false, // No scratches for overview
        'fast' // Default condition for overview
      );

      const confidence = calculateRaceConfidence(scoredHorses);
      const top = getTopHorses(scoredHorses, 3);

      confidences.set(index, confidence);
      topHorses.set(index, top);
    });

    return { raceConfidences: confidences, topHorsesByRace: topHorses };
  }, [parsedData]);

  // Get current race's scored horses for detail view (includes user modifications)
  const currentRaceScoredHorses = useMemo(() => {
    if (!parsedData || currentView !== 'detail') return [];

    const race = parsedData.races[selectedRaceIndex];
    if (!race) return [];

    return calculateRaceScores(
      race.horses,
      race.header,
      (i, originalOdds) => raceState.getOdds(i, originalOdds),
      (i) => raceState.isScratched(i),
      raceState.trackCondition
    );
  }, [parsedData, selectedRaceIndex, currentView, raceState]);

  // Current race confidence (recalculated when user makes changes)
  const currentRaceConfidence = useMemo(() => {
    if (currentView !== 'detail') {
      return raceConfidences.get(selectedRaceIndex) || 0;
    }
    return calculateRaceConfidence(currentRaceScoredHorses);
  }, [currentView, raceConfidences, selectedRaceIndex, currentRaceScoredHorses]);

  // Get post time string from current race
  const currentPostTimeString = useMemo(() => {
    if (!parsedData || !parsedData.races.length) return undefined;
    const race = parsedData.races[selectedRaceIndex];
    return race?.header?.postTime;
  }, [parsedData, selectedRaceIndex]);

  // Get race date string for post time calculation
  const currentRaceDateString = useMemo(() => {
    if (!parsedData || !parsedData.races.length) return undefined;
    const race = parsedData.races[selectedRaceIndex];
    return race?.header?.raceDateRaw;
  }, [parsedData, selectedRaceIndex]);

  // Post time countdown hook
  const {
    countdown,
    postTimeFormatted,
    pendingNotifications,
    clearNotification,
    notificationSettings,
    updateNotificationSettings,
  } = usePostTime(currentPostTimeString, currentRaceDateString);

  // Handle pending notifications
  useEffect(() => {
    if (pendingNotifications.length > 0) {
      const currentRace = parsedData?.races[selectedRaceIndex];
      const raceNumber = currentRace?.header?.raceNumber;

      pendingNotifications.forEach((notification) => {
        addPostTimeNotification(notification.minutesMark, raceNumber);
        clearNotification(notification.minutesMark);
      });
    }
  }, [
    pendingNotifications,
    parsedData,
    selectedRaceIndex,
    addPostTimeNotification,
    clearNotification,
  ]);

  // View navigation handlers
  const handleRaceSelect = useCallback((raceIndex: number) => {
    setSelectedRaceIndex(raceIndex);
    setCurrentView('detail');
  }, []);

  const handleBackToOverview = useCallback(() => {
    setCurrentView('overview');
  }, []);

  // Open bankroll settings modal
  const openBankrollSettings = useCallback(() => {
    setBankrollSettingsOpen(true);
  }, []);

  // Close bankroll settings modal
  const closeBankrollSettings = useCallback(() => {
    setBankrollSettingsOpen(false);
  }, []);

  // Toggle post time detail modal
  const togglePostTimeDetail = useCallback(() => {
    setPostTimeDetailOpen((prev) => !prev);
  }, []);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Handle file upload click
  const handleUploadClick = useCallback(() => {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }, []);

  // Handle mobile tab change
  const handleMobileTabChange = useCallback(
    (tab: 'dashboard' | 'upload' | 'settings') => {
      setMobileTab(tab);
      if (tab === 'upload') {
        handleUploadClick();
      }
    },
    [handleUploadClick]
  );

  // Get current race info for top bar
  const currentRaceInfo = useMemo(() => {
    if (!parsedData || !parsedData.races.length) return undefined;

    const race = parsedData.races[selectedRaceIndex];
    return {
      trackName: race?.header?.trackCode || 'Unknown Track',
      raceNumber: race?.header?.raceNumber || selectedRaceIndex + 1,
      postTime: race?.header?.postTime,
    };
  }, [parsedData, selectedRaceIndex]);

  // Compute race tabs data for panel architecture
  const raceTabsData = useMemo(() => {
    if (!parsedData || !parsedData.races.length) return [];

    return parsedData.races.map((race, index) => ({
      raceNumber: race.header.raceNumber,
      surface: race.header.surface || 'Dirt',
      distance: race.header.distance || '',
      confidence: raceConfidences.get(index) || 0,
    }));
  }, [parsedData, raceConfidences]);

  // Track code and date for RaceTabsBar
  const trackCode = parsedData?.races[0]?.header?.trackCode || '';
  const raceDate = parsedData?.races[0]?.header?.raceDate || '';

  // Toggle drawer
  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    if (!parsedData) return { races: 0, horses: 0 };
    return {
      races: parsedData.races.length,
      horses: parsedData.races.reduce((sum, race) => sum + race.horses.length, 0),
    };
  }, [parsedData]);

  // Handle file upload from onboarding flow
  const handleOnboardingFileUpload = useCallback(
    (data: ParsedDRFFile) => {
      onParsed(data);
    },
    [onParsed]
  );

  // Show onboarding for new users who haven't completed it and have no data
  if (!isOnboardingComplete && !hasData) {
    return (
      <OnboardingFlow onComplete={completeOnboarding} onFileUploaded={handleOnboardingFileUpload} />
    );
  }

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
        onOpenLegalModal={onOpenLegalModal}
        onNavigateToAccount={onNavigateToAccount}
        onNavigateToHelp={onNavigateToHelp}
      />

      {/* Main container */}
      <div className="dashboard-main">
        {/* Top bar */}
        <TopBar
          currentRace={currentView === 'detail' ? currentRaceInfo : undefined}
          onUploadClick={handleUploadClick}
          onMenuClick={toggleSidebar}
          onSettingsClick={openBankrollSettings}
          hasData={hasData}
          bankroll={bankroll}
          onOpenBankrollSettings={openBankrollSettings}
          countdown={currentView === 'detail' ? countdown : undefined}
          onCountdownClick={togglePostTimeDetail}
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
              <DataValidationWarning warnings={validationWarnings} onDismiss={onDismissWarnings} />
            </FadeIn>
          )}

          {/* View Content - Overview or Detail */}
          <AnimatePresence mode="wait">
            {!hasData ? (
              // Empty state - no data uploaded
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="dashboard-empty-container"
              >
                <div className="dashboard-grid">
                  {/* LEFT COLUMN - Info */}
                  <aside className="dashboard-column left" aria-label="Info">
                    <FadeIn delay={0.2}>
                      <div className="dashboard-stats-card">
                        <div className="stats-header">
                          <span className="material-icons">bar_chart</span>
                          <span>Session Stats</span>
                        </div>
                        <div className="stats-grid">
                          <div className="stat-item">
                            <span className="stat-value">—</span>
                            <span className="stat-label">Races</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-value">—</span>
                            <span className="stat-label">Horses</span>
                          </div>
                        </div>
                      </div>
                    </FadeIn>
                  </aside>

                  {/* CENTER COLUMN - Empty State */}
                  <section className="dashboard-column center" aria-label="Upload prompt">
                    <EmptyStateTable onUploadClick={handleUploadClick} isLoading={isLoading} />
                  </section>

                  {/* RIGHT COLUMN - Bankroll */}
                  <aside className="dashboard-column right" aria-label="Betting overview">
                    <BankrollSummaryCard
                      bankroll={bankroll}
                      onOpenSettings={openBankrollSettings}
                      variant="full"
                    />
                    <FadeIn delay={0.2}>
                      <div className="betting-empty-state">
                        <span className="material-icons betting-empty-icon">casino</span>
                        <h4>Ready to Bet</h4>
                        <p>
                          Upload race data to see betting recommendations and track your wagers.
                        </p>
                      </div>
                    </FadeIn>
                  </aside>
                </div>
              </motion.div>
            ) : currentView === 'overview' ? (
              // Race Overview - all races with confidence badges
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="dashboard-overview-container"
              >
                <div className="dashboard-grid">
                  {/* LEFT COLUMN - Stats */}
                  <aside className="dashboard-column left" aria-label="Session info">
                    <FadeIn delay={0.1}>
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
                            <span className="stat-value">
                              {parsedData?.filename?.split('.')[0]?.slice(0, 8) || '—'}
                            </span>
                            <span className="stat-label">File</span>
                          </div>
                        </div>
                      </div>
                    </FadeIn>

                    <FadeIn delay={0.2}>
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

                  {/* CENTER COLUMN - Race Overview Grid */}
                  <section className="dashboard-column center" aria-label="Race overview">
                    <RaceOverview
                      parsedData={parsedData}
                      raceConfidences={raceConfidences}
                      topHorsesByRace={topHorsesByRace}
                      onRaceSelect={handleRaceSelect}
                    />
                  </section>

                  {/* RIGHT COLUMN - Bankroll */}
                  <aside className="dashboard-column right" aria-label="Betting overview">
                    <BankrollSummaryCard
                      bankroll={bankroll}
                      onOpenSettings={openBankrollSettings}
                      variant="full"
                    />

                    <FadeIn delay={0.2}>
                      <div className="betting-tips-card">
                        <div className="tips-header">
                          <span className="material-icons">lightbulb</span>
                          <span>Quick Tips</span>
                        </div>
                        <ul className="tips-list">
                          <li>
                            <span className="material-icons">check_circle</span>
                            <span>Click any race card to view details</span>
                          </li>
                          <li>
                            <span className="material-icons">check_circle</span>
                            <span>Confidence shows analysis quality</span>
                          </li>
                          <li>
                            <span className="material-icons">check_circle</span>
                            <span>Green borders indicate Tier 1 picks</span>
                          </li>
                        </ul>
                      </div>
                    </FadeIn>
                  </aside>
                </div>
              </motion.div>
            ) : parsedData.races[selectedRaceIndex] ? (
              // Race Detail - single race deep dive with panel architecture
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="dashboard-detail-container panel-layout"
              >
                {/* Race Tabs Bar */}
                <RaceTabsBar
                  races={raceTabsData}
                  activeRaceIndex={selectedRaceIndex}
                  onRaceSelect={(index) => setSelectedRaceIndex(index)}
                  trackCode={trackCode}
                  raceDate={raceDate}
                />

                {/* Main content area with drawer */}
                <div className="panel-layout-main">
                  {/* Analysis Area */}
                  <div className="analysis-area">
                    <div className="analysis-area-content">
                      <RaceDetail
                        race={parsedData.races[selectedRaceIndex]}
                        confidence={currentRaceConfidence}
                        raceState={raceState}
                        onBack={handleBackToOverview}
                      />
                    </div>
                  </div>

                  {/* Betting Drawer */}
                  <BettingDrawer
                    isOpen={drawerOpen}
                    onToggle={toggleDrawer}
                    bankrollContent={
                      <BankrollSummaryCard
                        bankroll={bankroll}
                        onOpenSettings={openBankrollSettings}
                        variant="compact"
                      />
                    }
                    recommendationsContent={
                      currentRaceScoredHorses.length > 0 ? (
                        <BettingRecommendations
                          horses={currentRaceScoredHorses}
                          raceNumber={parsedData.races[selectedRaceIndex].header.raceNumber}
                          bankroll={bankroll}
                          onOpenBankrollSettings={openBankrollSettings}
                        />
                      ) : (
                        <div className="betting-empty-state">
                          <span className="material-icons betting-empty-icon">info</span>
                          <p>No betting recommendations available</p>
                        </div>
                      )
                    }
                  />
                </div>

                {/* Status Bar */}
                <StatusBar
                  trackDbLoaded={true}
                  isCalculating={false}
                  isOffline={isOffline}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Footer - only show in overview */}
          {currentView === 'overview' && hasData && (
            <FadeIn delay={0.4}>
              <div className="dashboard-enterprise-section">
                <div className="enterprise-card">
                  <div className="enterprise-header">
                    <span className="material-icons">api</span>
                    <span>API Access</span>
                    <span className="enterprise-badge">Enterprise</span>
                  </div>
                  <p className="enterprise-description">
                    Integrate Furlong analytics into your applications with our REST API.
                  </p>
                  <button className="enterprise-btn" disabled>
                    Learn More
                  </button>
                </div>
              </div>
            </FadeIn>
          )}
        </main>

        {/* Footer with Legal Links */}
        <Footer onOpenLegalModal={onOpenLegalModal} />
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav activeTab={mobileTab} onTabChange={handleMobileTabChange} hasData={hasData} />

      {/* Toast Notifications - Container is rendered by ToastProvider in App.tsx */}

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
        notificationSettings={notificationSettings}
        onNotificationSettingsChange={updateNotificationSettings}
      />

      {/* Post Time Detail Modal */}
      <PostTimeDetailModal
        isOpen={postTimeDetailOpen}
        onClose={() => setPostTimeDetailOpen(false)}
        countdown={countdown}
        postTimeFormatted={postTimeFormatted}
        raceNumber={currentRaceInfo?.raceNumber}
        trackName={currentRaceInfo?.trackName}
      />

      {/* PWA Features - Offline, Install, Update */}
      <OfflineIndicator />
      <InstallPrompt position="bottom-right" />
      <UpdatePrompt />
    </div>
  );
}

export default Dashboard;
