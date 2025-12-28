import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UseBankrollReturn } from '../hooks/useBankroll';
import { EXPERIENCE_LEVEL_INFO } from '../hooks/useBankroll';

interface BankrollSummaryCardProps {
  bankroll: UseBankrollReturn;
  onOpenSettings: () => void;
  className?: string;
  variant?: 'full' | 'compact' | 'mobile';
}

export function BankrollSummaryCard({
  bankroll,
  onOpenSettings,
  className = '',
  variant = 'full',
}: BankrollSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const {
    settings,
    getDailyBudget,
    getRaceBudget,
    getRemainingDaily,
    getSpentToday,
    getUnitSize,
    formatCurrency,
    isApproachingLimit,
    isOverBudget,
    getWarningMessage,
    dailyPL,
    getComplexityMode,
    getExperienceLevel,
  } = bankroll;

  const mode = getComplexityMode();
  const experienceLevel = getExperienceLevel();
  const isSimplifiedMode = experienceLevel !== 'advanced';
  const dailyBudget = getDailyBudget();
  const remaining = getRemainingDaily();
  const spent = getSpentToday();
  const raceBudget = getRaceBudget();
  const unitSize = getUnitSize();
  const progressPercent = Math.min(100, (spent / dailyBudget) * 100);
  const warningMessage = getWarningMessage();

  // Render compact version for mobile header
  if (variant === 'compact') {
    return (
      <button
        className={`bankroll-indicator ${className}`}
        onClick={onOpenSettings}
        aria-label="Open bankroll settings"
      >
        <div className="bankroll-indicator-content">
          <div className="bankroll-indicator-item">
            <span className="bankroll-indicator-label">Budget</span>
            <span className="bankroll-indicator-value">{formatCurrency(raceBudget)}</span>
          </div>
          <div className="bankroll-indicator-divider" />
          <div className="bankroll-indicator-item">
            <span className="bankroll-indicator-label">Level</span>
            <span className="bankroll-indicator-value">
              <span className="material-icons" style={{ fontSize: 14, marginRight: 4 }}>
                {EXPERIENCE_LEVEL_INFO[experienceLevel].icon}
              </span>
              {EXPERIENCE_LEVEL_INFO[experienceLevel].label}
            </span>
          </div>
        </div>
        <span className="material-icons bankroll-indicator-arrow">chevron_right</span>
      </button>
    );
  }

  // Render mobile collapsible version
  if (variant === 'mobile') {
    return (
      <motion.div
        className={`bankroll-summary-card mobile ${className} ${isExpanded ? 'expanded' : 'collapsed'}`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Collapse header */}
        <button
          className="bankroll-summary-collapse-header"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <div className="bankroll-summary-collapse-left">
            <span className="material-icons bankroll-summary-icon">account_balance_wallet</span>
            <span className="bankroll-summary-collapse-title">Budget</span>
            <span className={`bankroll-summary-collapse-badge experience-${experienceLevel}`}>
              {EXPERIENCE_LEVEL_INFO[experienceLevel].label}
            </span>
          </div>
          <div className="bankroll-summary-collapse-right">
            <span className="bankroll-summary-collapse-amount">{formatCurrency(raceBudget)}</span>
            <span
              className={`material-icons bankroll-summary-chevron ${isExpanded ? 'expanded' : ''}`}
            >
              expand_more
            </span>
          </div>
        </button>

        {/* Expandable content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="bankroll-summary-collapse-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {/* Warning banner - only for advanced mode */}
              {warningMessage && !isSimplifiedMode && (
                <div className={`bankroll-warning-banner ${isOverBudget() ? 'error' : 'warning'}`}>
                  <span className="material-icons">{isOverBudget() ? 'error' : 'warning'}</span>
                  <span>{warningMessage}</span>
                </div>
              )}

              {/* Simplified content for beginner/intermediate */}
              {isSimplifiedMode && (
                <div className="bankroll-simple-summary">
                  <div className="bankroll-simple-row">
                    <span className="bankroll-simple-label">Race Budget</span>
                    <span className="bankroll-simple-value">{formatCurrency(raceBudget)}</span>
                  </div>
                  <div className="bankroll-simple-row">
                    <span className="bankroll-simple-label">Experience</span>
                    <span className="bankroll-simple-value">
                      <span
                        className="material-icons"
                        style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}
                      >
                        {EXPERIENCE_LEVEL_INFO[experienceLevel].icon}
                      </span>
                      {EXPERIENCE_LEVEL_INFO[experienceLevel].label}
                    </span>
                  </div>
                  <div className="bankroll-simple-row">
                    <span className="bankroll-simple-label">What you'll see</span>
                    <span className="bankroll-simple-value" style={{ fontSize: '0.8rem' }}>
                      {EXPERIENCE_LEVEL_INFO[experienceLevel].description}
                    </span>
                  </div>
                </div>
              )}

              {!isSimplifiedMode && (
                <>
                  {/* Stats grid - only for advanced mode */}
                  <div className="bankroll-summary-stats-grid">
                    <div className="bankroll-stat-item">
                      <span className="material-icons bankroll-stat-icon">sports_score</span>
                      <div className="bankroll-stat-content">
                        <span className="bankroll-stat-label">Race Budget</span>
                        <span className="bankroll-stat-value">{formatCurrency(raceBudget)}</span>
                      </div>
                    </div>
                    <div className="bankroll-stat-item">
                      <span className="material-icons bankroll-stat-icon">today</span>
                      <div className="bankroll-stat-content">
                        <span className="bankroll-stat-label">Daily Budget</span>
                        <span className="bankroll-stat-value">{formatCurrency(dailyBudget)}</span>
                      </div>
                    </div>
                    <div className="bankroll-stat-item">
                      <span className="material-icons bankroll-stat-icon">monetization_on</span>
                      <div className="bankroll-stat-content">
                        <span className="bankroll-stat-label">Unit Size</span>
                        <span className="bankroll-stat-value">{formatCurrency(unitSize)}</span>
                      </div>
                    </div>
                    <div className="bankroll-stat-item">
                      <span className="material-icons bankroll-stat-icon">trending_up</span>
                      <div className="bankroll-stat-content">
                        <span className="bankroll-stat-label">Today's P&L</span>
                        <span
                          className={`bankroll-stat-value ${dailyPL >= 0 ? 'positive' : 'negative'}`}
                        >
                          {dailyPL >= 0 ? '+' : ''}
                          {formatCurrency(dailyPL)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Daily progress */}
                  <div className="bankroll-daily-progress">
                    <div className="bankroll-daily-progress-header">
                      <span>Daily Spending</span>
                      <span className={isOverBudget() ? 'over' : ''}>
                        {formatCurrency(spent)} / {formatCurrency(dailyBudget)}
                      </span>
                    </div>
                    <div className="bankroll-daily-progress-bar">
                      <div
                        className={`bankroll-daily-progress-fill ${isOverBudget() ? 'over' : isApproachingLimit() ? 'warning' : ''}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="bankroll-daily-remaining">
                      {formatCurrency(remaining)} remaining
                    </span>
                  </div>
                </>
              )}

              {/* Settings button */}
              <button className="bankroll-summary-settings-btn" onClick={onOpenSettings}>
                <span className="material-icons">tune</span>
                Adjust
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Full desktop version - mode-aware
  return (
    <motion.div
      className={`bankroll-summary-card mode-${mode} ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
    >
      {/* Header */}
      <div className="bankroll-summary-header">
        <div className="bankroll-summary-title-group">
          <span className="material-icons bankroll-summary-icon">account_balance_wallet</span>
          <h3 className="bankroll-summary-title">
            {isSimplifiedMode ? 'Race Budget' : 'Bankroll Summary'}
          </h3>
        </div>
        <span className={`bankroll-summary-mode-badge experience-${experienceLevel}`}>
          <span className="material-icons" style={{ fontSize: 14, marginRight: 4 }}>
            {EXPERIENCE_LEVEL_INFO[experienceLevel].icon}
          </span>
          {EXPERIENCE_LEVEL_INFO[experienceLevel].label}
        </span>
      </div>

      {/* Warning banner - only for advanced mode */}
      {warningMessage && !isSimplifiedMode && (
        <div className={`bankroll-warning-banner ${isOverBudget() ? 'error' : 'warning'}`}>
          <span className="material-icons">{isOverBudget() ? 'error' : 'warning'}</span>
          <span>{warningMessage}</span>
        </div>
      )}

      {/* SIMPLIFIED MODE - for Beginner/Intermediate */}
      {isSimplifiedMode && (
        <div className="bankroll-simple-content">
          <div className="bankroll-simple-main">
            <span className="bankroll-simple-amount">{formatCurrency(raceBudget)}</span>
            <span className="bankroll-simple-per-race">for this race</span>
          </div>
          <div className="bankroll-simple-style">
            <span className="material-icons bankroll-simple-style-emoji">
              {EXPERIENCE_LEVEL_INFO[experienceLevel].icon}
            </span>
            <span className="bankroll-simple-style-name">
              {EXPERIENCE_LEVEL_INFO[experienceLevel].description}
            </span>
          </div>
        </div>
      )}

      {/* ADVANCED MODE - full bankroll tracking */}
      {!isSimplifiedMode && (
        <>
          {/* Total bankroll */}
          <div className="bankroll-summary-total">
            <span className="bankroll-summary-total-label">Total Bankroll</span>
            <span className="bankroll-summary-total-value">
              {formatCurrency(settings.totalBankroll)}
            </span>
          </div>

          {/* Stats grid */}
          <div className="bankroll-summary-stats">
            <div className="bankroll-summary-stat">
              <span className="material-icons">sports_score</span>
              <div className="bankroll-summary-stat-content">
                <span className="bankroll-summary-stat-label">Race Budget</span>
                <span className="bankroll-summary-stat-value">{formatCurrency(raceBudget)}</span>
              </div>
            </div>
            <div className="bankroll-summary-stat">
              <span className="material-icons">calendar_today</span>
              <div className="bankroll-summary-stat-content">
                <span className="bankroll-summary-stat-label">Daily Budget</span>
                <span className="bankroll-summary-stat-value">{formatCurrency(dailyBudget)}</span>
              </div>
            </div>
            <div className="bankroll-summary-stat">
              <span className="material-icons">monetization_on</span>
              <div className="bankroll-summary-stat-content">
                <span className="bankroll-summary-stat-label">Unit Size</span>
                <span className="bankroll-summary-stat-value">{formatCurrency(unitSize)}</span>
              </div>
            </div>
          </div>

          {/* Daily progress */}
          <div className="bankroll-summary-progress-section">
            <div className="bankroll-summary-progress-header">
              <span className="bankroll-summary-progress-label">Daily Spending</span>
              <span className={`bankroll-summary-progress-value ${isOverBudget() ? 'over' : ''}`}>
                {formatCurrency(spent)} / {formatCurrency(dailyBudget)}
              </span>
            </div>
            <div className="bankroll-summary-progress-bar">
              <motion.div
                className={`bankroll-summary-progress-fill ${isOverBudget() ? 'over' : isApproachingLimit() ? 'warning' : ''}`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.3 }}
              />
            </div>
            <span className="bankroll-summary-remaining">
              {formatCurrency(remaining)} remaining today
            </span>
          </div>

          {/* Today's P&L */}
          <div className="bankroll-summary-pl">
            <span className="material-icons">trending_up</span>
            <span className="bankroll-summary-pl-label">Today's P&L</span>
            <span className={`bankroll-summary-pl-value ${dailyPL >= 0 ? 'positive' : 'negative'}`}>
              {dailyPL >= 0 ? '+' : ''}
              {formatCurrency(dailyPL)}
            </span>
          </div>
        </>
      )}

      {/* Settings button */}
      <button className="bankroll-summary-btn" onClick={onOpenSettings}>
        <span className="material-icons">tune</span>
        {mode === 'simple' ? 'Adjust' : mode === 'moderate' ? 'Adjust' : 'Adjust Settings'}
      </button>
    </motion.div>
  );
}

export default BankrollSummaryCard;
