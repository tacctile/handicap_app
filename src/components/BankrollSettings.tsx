import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RiskTolerance, BetUnitType, DailyBudgetType, BankrollSettings as BankrollSettingsType } from '../hooks/useBankroll'

interface BankrollSettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: BankrollSettingsType
  onSave: (settings: Partial<BankrollSettingsType>) => void
  onReset: () => void
  dailyPL: number
  spentToday: number
  dailyBudget: number
}

const RISK_OPTIONS: { value: RiskTolerance; label: string; description: string; range: string }[] = [
  { value: 'conservative', label: 'Conservative', description: 'Lower risk, smaller bets', range: '1-2% per unit' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced approach', range: '2-4% per unit' },
  { value: 'aggressive', label: 'Aggressive', description: 'Higher risk, larger bets', range: '4-6% per unit' },
]

export function BankrollSettings({
  isOpen,
  onClose,
  settings,
  onSave,
  onReset,
  dailyPL,
  spentToday,
  dailyBudget,
}: BankrollSettingsProps) {
  // Local form state
  const [formState, setFormState] = useState<BankrollSettingsType>(settings)
  const [hasChanges, setHasChanges] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Sync form state when settings change externally or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormState(settings)
      setHasChanges(false)
    }
  }, [settings, isOpen])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Update form field
  const updateField = useCallback(<K extends keyof BankrollSettingsType>(
    field: K,
    value: BankrollSettingsType[K]
  ) => {
    setFormState(prev => {
      const newState = { ...prev, [field]: value }
      setHasChanges(true)
      return newState
    })
  }, [])

  // Handle save
  const handleSave = useCallback(() => {
    onSave(formState)
    setHasChanges(false)
    onClose()
  }, [formState, onSave, onClose])

  // Handle reset
  const handleReset = useCallback(() => {
    onReset()
    setHasChanges(false)
  }, [onReset])

  // Format currency for display
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="bankroll-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal */}
          <motion.div
            className="bankroll-modal-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              ref={modalRef}
              className="bankroll-modal"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {/* Header */}
              <div className="bankroll-modal-header">
                <div className="bankroll-modal-title-group">
                  <span className="material-icons bankroll-modal-icon">account_balance_wallet</span>
                  <div>
                    <h2 className="bankroll-modal-title">Bankroll Management</h2>
                    <p className="bankroll-modal-subtitle">Configure your betting parameters</p>
                  </div>
                </div>
                <button
                  className="bankroll-modal-close"
                  onClick={onClose}
                  aria-label="Close settings"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="bankroll-modal-content">
                {/* Daily P&L Summary */}
                <div className="bankroll-pl-summary">
                  <div className="bankroll-pl-header">
                    <span className="material-icons">today</span>
                    <span>Today's Summary</span>
                  </div>
                  <div className="bankroll-pl-stats">
                    <div className="bankroll-pl-stat">
                      <span className="bankroll-pl-label">P&L</span>
                      <span className={`bankroll-pl-value ${dailyPL >= 0 ? 'positive' : 'negative'}`}>
                        {dailyPL >= 0 ? '+' : ''}{formatCurrency(dailyPL)}
                      </span>
                    </div>
                    <div className="bankroll-pl-stat">
                      <span className="bankroll-pl-label">Spent</span>
                      <span className="bankroll-pl-value">{formatCurrency(spentToday)}</span>
                    </div>
                    <div className="bankroll-pl-stat">
                      <span className="bankroll-pl-label">Budget</span>
                      <span className="bankroll-pl-value">{formatCurrency(dailyBudget)}</span>
                    </div>
                  </div>
                  <div className="bankroll-pl-progress">
                    <div
                      className="bankroll-pl-progress-bar"
                      style={{ width: `${Math.min(100, (spentToday / dailyBudget) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Settings Form */}
                <form className="bankroll-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                  {/* Total Bankroll */}
                  <div className="bankroll-form-group">
                    <label className="bankroll-form-label">
                      <span className="material-icons">savings</span>
                      Total Bankroll
                    </label>
                    <div className="bankroll-input-wrapper">
                      <span className="bankroll-input-prefix">$</span>
                      <input
                        type="number"
                        className="bankroll-input"
                        value={formState.totalBankroll}
                        onChange={(e) => updateField('totalBankroll', Math.max(0, Number(e.target.value)))}
                        min="0"
                        step="100"
                      />
                    </div>
                  </div>

                  {/* Daily Budget */}
                  <div className="bankroll-form-group">
                    <label className="bankroll-form-label">
                      <span className="material-icons">calendar_today</span>
                      Daily Budget
                    </label>
                    <div className="bankroll-input-row">
                      <select
                        className="bankroll-select"
                        value={formState.dailyBudgetType}
                        onChange={(e) => updateField('dailyBudgetType', e.target.value as DailyBudgetType)}
                      >
                        <option value="fixed">Fixed $</option>
                        <option value="percentage">% of Bankroll</option>
                      </select>
                      <div className="bankroll-input-wrapper">
                        <span className="bankroll-input-prefix">
                          {formState.dailyBudgetType === 'fixed' ? '$' : '%'}
                        </span>
                        <input
                          type="number"
                          className="bankroll-input"
                          value={formState.dailyBudgetValue}
                          onChange={(e) => updateField('dailyBudgetValue', Math.max(0, Number(e.target.value)))}
                          min="0"
                          step={formState.dailyBudgetType === 'fixed' ? '10' : '1'}
                        />
                      </div>
                    </div>
                    {formState.dailyBudgetType === 'percentage' && (
                      <span className="bankroll-input-hint">
                        = {formatCurrency((formState.dailyBudgetValue / 100) * formState.totalBankroll)}
                      </span>
                    )}
                  </div>

                  {/* Per-Race Budget */}
                  <div className="bankroll-form-group">
                    <label className="bankroll-form-label">
                      <span className="material-icons">sports_score</span>
                      Per-Race Budget
                    </label>
                    <div className="bankroll-input-wrapper">
                      <span className="bankroll-input-prefix">$</span>
                      <input
                        type="number"
                        className="bankroll-input"
                        value={formState.perRaceBudget}
                        onChange={(e) => updateField('perRaceBudget', Math.max(0, Number(e.target.value)))}
                        min="0"
                        step="10"
                      />
                    </div>
                  </div>

                  {/* Risk Tolerance */}
                  <div className="bankroll-form-group">
                    <label className="bankroll-form-label">
                      <span className="material-icons">speed</span>
                      Risk Tolerance
                    </label>
                    <div className="bankroll-risk-options">
                      {RISK_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={`bankroll-risk-option ${formState.riskTolerance === option.value ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="riskTolerance"
                            value={option.value}
                            checked={formState.riskTolerance === option.value}
                            onChange={(e) => updateField('riskTolerance', e.target.value as RiskTolerance)}
                          />
                          <div className="bankroll-risk-content">
                            <span className="bankroll-risk-label">{option.label}</span>
                            <span className="bankroll-risk-description">{option.description}</span>
                            <span className="bankroll-risk-range">{option.range}</span>
                          </div>
                          <div className="bankroll-risk-indicator" />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Default Bet Unit */}
                  <div className="bankroll-form-group">
                    <label className="bankroll-form-label">
                      <span className="material-icons">monetization_on</span>
                      Default Bet Unit
                    </label>
                    <div className="bankroll-input-row">
                      <select
                        className="bankroll-select"
                        value={formState.betUnitType}
                        onChange={(e) => updateField('betUnitType', e.target.value as BetUnitType)}
                      >
                        <option value="percentage">% of Bankroll</option>
                        <option value="fixed">Fixed $</option>
                      </select>
                      <div className="bankroll-input-wrapper">
                        <span className="bankroll-input-prefix">
                          {formState.betUnitType === 'fixed' ? '$' : '%'}
                        </span>
                        <input
                          type="number"
                          className="bankroll-input"
                          value={formState.betUnitValue}
                          onChange={(e) => updateField('betUnitValue', Math.max(0, Number(e.target.value)))}
                          min="0"
                          step={formState.betUnitType === 'fixed' ? '5' : '0.5'}
                        />
                      </div>
                    </div>
                    {formState.betUnitType === 'percentage' && (
                      <span className="bankroll-input-hint">
                        = {formatCurrency((formState.betUnitValue / 100) * formState.totalBankroll)} per unit
                      </span>
                    )}
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="bankroll-modal-footer">
                <button
                  type="button"
                  className="bankroll-btn bankroll-btn-ghost"
                  onClick={handleReset}
                >
                  <span className="material-icons">restart_alt</span>
                  Reset to Defaults
                </button>
                <div className="bankroll-footer-actions">
                  <button
                    type="button"
                    className="bankroll-btn bankroll-btn-secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bankroll-btn bankroll-btn-primary"
                    onClick={handleSave}
                    disabled={!hasChanges}
                  >
                    <span className="material-icons">save</span>
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default BankrollSettings
