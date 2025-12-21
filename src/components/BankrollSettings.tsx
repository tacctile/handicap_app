import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  RiskTolerance,
  BetUnitType,
  DailyBudgetType,
  BankrollSettings as BankrollSettingsType,
  ComplexityMode,
  BettingStyle,
  BetType,
} from '../hooks/useBankroll';
import { BETTING_STYLE_INFO, BET_TYPE_LABELS, getExpectedReturnRange } from '../hooks/useBankroll';
import type { NotificationSettings } from '../hooks/usePostTime';
import {
  type KellySettings,
  type KellyFraction,
  KELLY_FRACTION_OPTIONS,
  KELLY_FRACTION_INFO,
  DEFAULT_KELLY_SETTINGS,
  loadKellySettings,
  saveKellySettings,
} from '../lib/betting/kellySettings';
import {
  type DutchSettings,
  DEFAULT_DUTCH_SETTINGS,
  DUTCH_EDGE_OPTIONS,
  DUTCH_MAX_HORSES_OPTIONS,
  DUTCH_EDUCATION,
  loadDutchSettings,
  saveDutchSettings,
} from '../lib/dutch';
import { KellyHelpModal } from './KellyHelpModal';

interface BankrollSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BankrollSettingsType;
  onSave: (settings: Partial<BankrollSettingsType>) => void;
  onReset: () => void;
  dailyPL: number;
  spentToday: number;
  dailyBudget: number;
  notificationSettings?: NotificationSettings;
  onNotificationSettingsChange?: (settings: Partial<NotificationSettings>) => void;
}

const RISK_OPTIONS: { value: RiskTolerance; label: string; description: string; range: string }[] =
  [
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'Lower risk, smaller bets',
      range: '1-2% per unit',
    },
    {
      value: 'moderate',
      label: 'Moderate',
      description: 'Balanced approach',
      range: '2-4% per unit',
    },
    {
      value: 'aggressive',
      label: 'Aggressive',
      description: 'Higher risk, larger bets',
      range: '4-6% per unit',
    },
  ];

const NOTIFICATION_TIMING_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 10, label: '10 min' },
  { value: 5, label: '5 min' },
  { value: 2, label: '2 min' },
  { value: 1, label: '1 min' },
];

const MODE_OPTIONS: { value: ComplexityMode; label: string; description: string }[] = [
  { value: 'simple', label: 'Simple', description: 'Just tell us your budget and betting style' },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Set your risk level and favorite bet types',
  },
  { value: 'advanced', label: 'Advanced', description: 'Full control over bankroll and strategy' },
];

const BETTING_STYLES: BettingStyle[] = ['safe', 'balanced', 'aggressive'];

const BET_TYPES: BetType[] = ['win_place', 'exacta', 'trifecta', 'superfecta', 'multi_race'];

export function BankrollSettings({
  isOpen,
  onClose,
  settings,
  onSave,
  onReset,
  dailyPL,
  spentToday,
  dailyBudget,
  notificationSettings,
  onNotificationSettingsChange,
}: BankrollSettingsProps) {
  // Local form state
  const [formState, setFormState] = useState<BankrollSettingsType>(settings);
  const [notifState, setNotifState] = useState<NotificationSettings>(
    notificationSettings || { enabled: true, soundEnabled: false, timings: [15, 10, 5, 2] }
  );
  const [kellyState, setKellyState] = useState<KellySettings>(loadKellySettings);
  const [dutchState, setDutchState] = useState<DutchSettings>(loadDutchSettings);
  const [showKellyHelp, setShowKellyHelp] = useState(false);
  const [showDutchHelp, setShowDutchHelp] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'bankroll' | 'notifications'>('bankroll');
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync form state when settings change externally or modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing external state when modal opens
      setFormState(settings);
      if (notificationSettings) {
        setNotifState(notificationSettings);
      }
      setKellyState(loadKellySettings());
      setDutchState(loadDutchSettings());
      setHasChanges(false);
    }
  }, [settings, notificationSettings, isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Update form field
  const updateField = useCallback(
    <K extends keyof BankrollSettingsType>(field: K, value: BankrollSettingsType[K]) => {
      setFormState((prev) => {
        const newState = { ...prev, [field]: value };
        setHasChanges(true);
        return newState;
      });
    },
    []
  );

  // Toggle bet type for Moderate mode
  const toggleBetType = useCallback((betType: BetType) => {
    setFormState((prev) => {
      const currentTypes = prev.moderateSelectedBetTypes || [];
      const newTypes = currentTypes.includes(betType)
        ? currentTypes.filter((t) => t !== betType)
        : [...currentTypes, betType];
      setHasChanges(true);
      return { ...prev, moderateSelectedBetTypes: newTypes };
    });
  }, []);

  // Update notification field
  const updateNotifField = useCallback(
    <K extends keyof NotificationSettings>(field: K, value: NotificationSettings[K]) => {
      setNotifState((prev) => {
        const newState = { ...prev, [field]: value };
        setHasChanges(true);
        return newState;
      });
    },
    []
  );

  // Update Kelly field
  const updateKellyField = useCallback(
    <K extends keyof KellySettings>(field: K, value: KellySettings[K]) => {
      setKellyState((prev) => {
        const newState = { ...prev, [field]: value };
        setHasChanges(true);
        return newState;
      });
    },
    []
  );

  // Update Dutch field
  const updateDutchField = useCallback(
    <K extends keyof DutchSettings>(field: K, value: DutchSettings[K]) => {
      setDutchState((prev) => {
        const newState = { ...prev, [field]: value };
        setHasChanges(true);
        return newState;
      });
    },
    []
  );

  // Toggle notification timing
  const toggleNotifTiming = useCallback((timing: number) => {
    setNotifState((prev) => {
      const newTimings = prev.timings.includes(timing)
        ? prev.timings.filter((t) => t !== timing)
        : [...prev.timings, timing].sort((a, b) => b - a);
      setHasChanges(true);
      return { ...prev, timings: newTimings };
    });
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    onSave(formState);
    if (onNotificationSettingsChange) {
      onNotificationSettingsChange(notifState);
    }
    // Save Kelly settings separately (stored in localStorage)
    saveKellySettings(kellyState);
    // Save Dutch settings separately (stored in localStorage)
    saveDutchSettings(dutchState);
    setHasChanges(false);
    onClose();
  }, [
    formState,
    notifState,
    kellyState,
    dutchState,
    onSave,
    onNotificationSettingsChange,
    onClose,
  ]);

  // Handle reset
  const handleReset = useCallback(() => {
    onReset();
    setNotifState({ enabled: true, soundEnabled: false, timings: [15, 10, 5, 2] });
    setKellyState(DEFAULT_KELLY_SETTINGS);
    saveKellySettings(DEFAULT_KELLY_SETTINGS);
    setDutchState(DEFAULT_DUTCH_SETTINGS);
    saveDutchSettings(DEFAULT_DUTCH_SETTINGS);
    setHasChanges(false);
  }, [onReset]);

  // Format currency for display
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Render Mode Selector
  const renderModeSelector = () => (
    <div className="complexity-mode-selector">
      <div className="complexity-mode-buttons">
        {MODE_OPTIONS.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={`complexity-mode-btn ${formState.complexityMode === mode.value ? 'selected' : ''}`}
            onClick={() => updateField('complexityMode', mode.value)}
          >
            <span className="complexity-mode-label">{mode.label}</span>
          </button>
        ))}
      </div>
      <p className="complexity-mode-description">
        {MODE_OPTIONS.find((m) => m.value === formState.complexityMode)?.description}
      </p>
    </div>
  );

  // Render Simple Mode Form
  const renderSimpleMode = () => (
    <motion.div
      key="simple-mode"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="simple-mode-form"
    >
      {/* Race Budget Input */}
      <div className="simple-budget-section">
        <label className="simple-budget-label">How much for this race?</label>
        <div className="simple-budget-input-wrapper">
          <span className="simple-budget-prefix">$</span>
          <input
            type="number"
            className="simple-budget-input"
            value={formState.simpleRaceBudget}
            onChange={(e) => updateField('simpleRaceBudget', Math.max(1, Number(e.target.value)))}
            min="1"
            step="5"
            placeholder="20"
          />
        </div>
      </div>

      {/* Betting Style Presets */}
      <div className="simple-style-section">
        <label className="simple-style-label">Pick your style:</label>
        <div className="simple-style-options">
          {BETTING_STYLES.map((style) => {
            const info = BETTING_STYLE_INFO[style];
            return (
              <label
                key={style}
                className={`simple-style-option ${formState.simpleBettingStyle === style ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="bettingStyle"
                  value={style}
                  checked={formState.simpleBettingStyle === style}
                  onChange={() => updateField('simpleBettingStyle', style)}
                />
                <span className="simple-style-emoji">{info.emoji}</span>
                <div className="simple-style-content">
                  <span className="simple-style-name">{info.label}</span>
                  <span className="simple-style-description">{info.description}</span>
                </div>
                <div className="simple-style-check">
                  <span className="material-icons">check_circle</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <p className="simple-mode-hint">
        <span className="material-icons">auto_awesome</span>
        We'll suggest bets based on your choice
      </p>
    </motion.div>
  );

  // Render Moderate Mode Form
  const renderModerateMode = () => (
    <motion.div
      key="moderate-mode"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="moderate-mode-form"
    >
      {/* Race Budget */}
      <div className="bankroll-form-group">
        <label className="bankroll-form-label">
          <span className="material-icons">sports_score</span>
          Race Budget
        </label>
        <div className="bankroll-input-wrapper">
          <span className="bankroll-input-prefix">$</span>
          <input
            type="number"
            className="bankroll-input"
            value={formState.moderateRaceBudget}
            onChange={(e) => updateField('moderateRaceBudget', Math.max(0, Number(e.target.value)))}
            min="0"
            step="10"
          />
        </div>
      </div>

      {/* Risk Tolerance Slider */}
      <div className="bankroll-form-group">
        <label className="bankroll-form-label">
          <span className="material-icons">speed</span>
          Risk Tolerance
        </label>
        <div className="moderate-risk-slider">
          <div className="moderate-risk-track">
            {(['conservative', 'moderate', 'aggressive'] as RiskTolerance[]).map((level, index) => (
              <button
                key={level}
                type="button"
                className={`moderate-risk-point ${formState.moderateRiskLevel === level ? 'selected' : ''}`}
                onClick={() => updateField('moderateRiskLevel', level)}
                style={{ left: `${index * 50}%` }}
              >
                <span className="moderate-risk-dot" />
                <span className="moderate-risk-label">
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </span>
              </button>
            ))}
            <div
              className="moderate-risk-fill"
              style={{
                width: `${formState.moderateRiskLevel === 'conservative' ? 0 : formState.moderateRiskLevel === 'moderate' ? 50 : 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Bet Types */}
      <div className="bankroll-form-group">
        <label className="bankroll-form-label">
          <span className="material-icons">style</span>
          Which bet types do you like?
        </label>
        <div className="moderate-bet-types">
          {BET_TYPES.map((betType) => (
            <label
              key={betType}
              className={`moderate-bet-type-option ${(formState.moderateSelectedBetTypes || []).includes(betType) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={(formState.moderateSelectedBetTypes || []).includes(betType)}
                onChange={() => toggleBetType(betType)}
              />
              <span className="moderate-bet-type-checkbox">
                <span className="material-icons">
                  {(formState.moderateSelectedBetTypes || []).includes(betType)
                    ? 'check_box'
                    : 'check_box_outline_blank'}
                </span>
              </span>
              <span className="moderate-bet-type-label">{BET_TYPE_LABELS[betType]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Expected Return Range */}
      <div className="moderate-expected-return">
        <span className="material-icons">trending_up</span>
        <span className="moderate-expected-label">Expected return range:</span>
        <span className="moderate-expected-value">
          {getExpectedReturnRange(
            formState.moderateRiskLevel,
            formState.moderateSelectedBetTypes || []
          )}
        </span>
      </div>
    </motion.div>
  );

  // Render Advanced Mode Form (existing form)
  const renderAdvancedMode = () => (
    <motion.div
      key="advanced-mode"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
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
              {dailyPL >= 0 ? '+' : ''}
              {formatCurrency(dailyPL)}
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
      <form
        className="bankroll-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
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
                onChange={(e) =>
                  updateField('dailyBudgetValue', Math.max(0, Number(e.target.value)))
                }
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

        {/* Kelly Criterion Section */}
        <div className="bankroll-kelly-section">
          <div className="bankroll-kelly-header">
            <div className="bankroll-kelly-title">
              <span className="material-icons">functions</span>
              <div>
                <span className="bankroll-kelly-label">Kelly Criterion</span>
                <span className="bankroll-kelly-badge">Advanced</span>
              </div>
            </div>
            <label className="bankroll-toggle">
              <input
                type="checkbox"
                checked={kellyState.enabled}
                onChange={(e) => updateKellyField('enabled', e.target.checked)}
              />
              <span className="bankroll-toggle-slider" />
            </label>
          </div>

          <p className="bankroll-kelly-description">
            Mathematically optimizes bet sizing for maximum bankroll growth based on your edge.
          </p>

          <AnimatePresence>
            {kellyState.enabled && (
              <motion.div
                className="bankroll-kelly-settings"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Kelly Fraction */}
                <div className="bankroll-form-group">
                  <label className="bankroll-form-label">
                    <span className="material-icons">pie_chart</span>
                    Kelly Fraction
                  </label>
                  <div className="bankroll-kelly-fraction-options">
                    {KELLY_FRACTION_OPTIONS.map((option) => {
                      const info = KELLY_FRACTION_INFO[option.value];
                      return (
                        <label
                          key={option.value}
                          className={`bankroll-kelly-fraction-option ${kellyState.kellyFraction === option.value ? 'selected' : ''}`}
                          style={{
                            borderColor:
                              kellyState.kellyFraction === option.value ? info.color : undefined,
                          }}
                        >
                          <input
                            type="radio"
                            name="kellyFraction"
                            value={option.value}
                            checked={kellyState.kellyFraction === option.value}
                            onChange={() =>
                              updateKellyField('kellyFraction', option.value as KellyFraction)
                            }
                          />
                          <div className="bankroll-kelly-fraction-content">
                            <span
                              className="bankroll-kelly-fraction-label"
                              style={{
                                color:
                                  kellyState.kellyFraction === option.value
                                    ? info.color
                                    : undefined,
                              }}
                            >
                              {option.shortLabel}
                            </span>
                            <span className="bankroll-kelly-fraction-desc">
                              {option.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <span className="bankroll-input-hint bankroll-kelly-hint">
                    <span className="material-icons">info</span>
                    Quarter Kelly recommended for most bettors (75% less variance)
                  </span>
                </div>

                {/* Max Bet Percent */}
                <div className="bankroll-form-group">
                  <label className="bankroll-form-label">
                    <span className="material-icons">vertical_align_top</span>
                    Maximum Bet Cap
                  </label>
                  <div className="bankroll-kelly-slider-group">
                    <input
                      type="range"
                      className="bankroll-kelly-slider"
                      min="1"
                      max="20"
                      value={kellyState.maxBetPercent}
                      onChange={(e) => updateKellyField('maxBetPercent', Number(e.target.value))}
                    />
                    <span className="bankroll-kelly-slider-value">{kellyState.maxBetPercent}%</span>
                  </div>
                  <span className="bankroll-input-hint">
                    Never bet more than {kellyState.maxBetPercent}% of bankroll on a single bet
                  </span>
                </div>

                {/* Min Edge Required */}
                <div className="bankroll-form-group">
                  <label className="bankroll-form-label">
                    <span className="material-icons">trending_up</span>
                    Minimum Edge Required
                  </label>
                  <div className="bankroll-kelly-slider-group">
                    <input
                      type="range"
                      className="bankroll-kelly-slider"
                      min="1"
                      max="25"
                      value={kellyState.minEdgeRequired}
                      onChange={(e) => updateKellyField('minEdgeRequired', Number(e.target.value))}
                    />
                    <span className="bankroll-kelly-slider-value">
                      {kellyState.minEdgeRequired}%
                    </span>
                  </div>
                  <span className="bankroll-input-hint">
                    Only bet when you have at least {kellyState.minEdgeRequired}% edge over the odds
                  </span>
                </div>

                {/* Kelly Info */}
                <div className="bankroll-kelly-info">
                  <span className="material-icons">help_outline</span>
                  <span>
                    Kelly Criterion calculates optimal bet size based on your edge. When enabled,
                    bet recommendations will show Kelly-calculated amounts alongside tier-based
                    allocations.
                  </span>
                </div>

                {/* Learn More Link */}
                <button
                  type="button"
                  className="bankroll-kelly-learn-more"
                  onClick={() => setShowKellyHelp(true)}
                >
                  <span className="material-icons">school</span>
                  <span>Learn more about Kelly Criterion</span>
                  <span className="material-icons">arrow_forward</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dutch Booking Section */}
        <div className="bankroll-dutch-section">
          <div className="bankroll-dutch-header">
            <div className="bankroll-dutch-title">
              <span className="material-icons">balance</span>
              <div>
                <span className="bankroll-dutch-label">Dutch Booking</span>
                <span className="bankroll-dutch-badge">Advanced</span>
              </div>
            </div>
            <label className="bankroll-toggle">
              <input
                type="checkbox"
                checked={dutchState.enabled}
                onChange={(e) => updateDutchField('enabled', e.target.checked)}
              />
              <span className="bankroll-toggle-slider" />
            </label>
          </div>

          <p className="bankroll-dutch-description">{DUTCH_EDUCATION.overview}</p>

          <AnimatePresence>
            {dutchState.enabled && (
              <motion.div
                className="bankroll-dutch-settings"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Minimum Edge Required */}
                <div className="bankroll-form-group">
                  <label className="bankroll-form-label">
                    <span className="material-icons">trending_up</span>
                    Minimum Edge Required
                  </label>
                  <div className="bankroll-dutch-edge-options">
                    {DUTCH_EDGE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`bankroll-dutch-option ${dutchState.minEdgeRequired === option.value ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="dutchEdge"
                          value={option.value}
                          checked={dutchState.minEdgeRequired === option.value}
                          onChange={() => updateDutchField('minEdgeRequired', option.value)}
                        />
                        <span className="bankroll-dutch-option-label">{option.label}</span>
                        <span className="bankroll-dutch-option-desc">{option.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Maximum Horses */}
                <div className="bankroll-form-group">
                  <label className="bankroll-form-label">
                    <span className="material-icons">format_list_numbered</span>
                    Maximum Horses in Dutch
                  </label>
                  <div className="bankroll-dutch-horses-options">
                    {DUTCH_MAX_HORSES_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`bankroll-dutch-option ${dutchState.maxHorses === option.value ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="dutchMaxHorses"
                          value={option.value}
                          checked={dutchState.maxHorses === option.value}
                          onChange={() => updateDutchField('maxHorses', option.value)}
                        />
                        <span className="bankroll-dutch-option-label">{option.label}</span>
                        <span className="bankroll-dutch-option-desc">{option.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Overlay Only Toggle */}
                <div className="bankroll-form-group dutch-toggle-group">
                  <label className="bankroll-form-label">
                    <span className="material-icons">filter_list</span>
                    Only Overlay Horses
                  </label>
                  <label className="bankroll-toggle">
                    <input
                      type="checkbox"
                      checked={dutchState.overlayOnly}
                      onChange={(e) => updateDutchField('overlayOnly', e.target.checked)}
                    />
                    <span className="bankroll-toggle-slider" />
                  </label>
                </div>

                {/* Prefer Mixed Tiers Toggle */}
                <div className="bankroll-form-group dutch-toggle-group">
                  <label className="bankroll-form-label">
                    <span className="material-icons">layers</span>
                    Prefer Mixed Tier Combinations
                  </label>
                  <label className="bankroll-toggle">
                    <input
                      type="checkbox"
                      checked={dutchState.preferMixedTiers}
                      onChange={(e) => updateDutchField('preferMixedTiers', e.target.checked)}
                    />
                    <span className="bankroll-toggle-slider" />
                  </label>
                </div>

                {/* Dutch Info */}
                <div className="bankroll-dutch-info">
                  <span className="material-icons">help_outline</span>
                  <span>
                    Dutch booking spreads risk across multiple horses to guarantee profit if any
                    selected horse wins. Only works when combined odds create an overlay (sum of
                    implied probabilities &lt; 100%).
                  </span>
                </div>

                {/* Learn More Link */}
                <button
                  type="button"
                  className="bankroll-dutch-learn-more"
                  onClick={() => setShowDutchHelp(!showDutchHelp)}
                >
                  <span className="material-icons">school</span>
                  <span>How Dutch Booking Works</span>
                  <span className={`material-icons ${showDutchHelp ? 'rotated' : ''}`}>
                    expand_more
                  </span>
                </button>

                {/* Dutch Help Section */}
                <AnimatePresence>
                  {showDutchHelp && (
                    <motion.div
                      className="bankroll-dutch-help"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="dutch-help-section">
                        <h4>How It Works</h4>
                        <p>{DUTCH_EDUCATION.howItWorks}</p>
                      </div>
                      <div className="dutch-help-section">
                        <h4>Example</h4>
                        <pre className="dutch-help-example">{DUTCH_EDUCATION.example}</pre>
                      </div>
                      <div className="dutch-help-section">
                        <h4>Requirements</h4>
                        <ul>
                          {DUTCH_EDUCATION.requirements.map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="dutch-help-section">
                        <h4>Warnings</h4>
                        <ul className="dutch-help-warnings">
                          {DUTCH_EDUCATION.warnings.map((warn, idx) => (
                            <li key={idx}>{warn}</li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>

      {/* Kelly Help Modal */}
      <KellyHelpModal isOpen={showKellyHelp} onClose={() => setShowKellyHelp(false)} />
    </motion.div>
  );

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
                  <span className="material-icons bankroll-modal-icon">settings</span>
                  <div>
                    <h2 className="bankroll-modal-title">Settings</h2>
                    <p className="bankroll-modal-subtitle">Configure bankroll and notifications</p>
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

              {/* Tabs */}
              <div className="bankroll-modal-tabs">
                <button
                  className={`bankroll-modal-tab ${activeTab === 'bankroll' ? 'active' : ''}`}
                  onClick={() => setActiveTab('bankroll')}
                >
                  <span className="material-icons">account_balance_wallet</span>
                  <span>Bankroll</span>
                </button>
                <button
                  className={`bankroll-modal-tab ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                >
                  <span className="material-icons">notifications</span>
                  <span>Notifications</span>
                </button>
              </div>

              {/* Content */}
              <div className="bankroll-modal-content">
                <AnimatePresence mode="wait">
                  {activeTab === 'bankroll' ? (
                    <motion.div
                      key="bankroll"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Mode Selector */}
                      {renderModeSelector()}

                      {/* Form content based on mode */}
                      <AnimatePresence mode="wait">
                        {formState.complexityMode === 'simple' && renderSimpleMode()}
                        {formState.complexityMode === 'moderate' && renderModerateMode()}
                        {formState.complexityMode === 'advanced' && renderAdvancedMode()}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="notifications"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="notification-settings"
                    >
                      {/* Enable Notifications */}
                      <div className="notification-toggle-group">
                        <div className="notification-toggle-header">
                          <span className="material-icons">notifications_active</span>
                          <div className="notification-toggle-text">
                            <span className="notification-toggle-label">Post Time Alerts</span>
                            <span className="notification-toggle-description">
                              Get notified when race time is approaching
                            </span>
                          </div>
                        </div>
                        <label className="notification-switch">
                          <input
                            type="checkbox"
                            checked={notifState.enabled}
                            onChange={(e) => updateNotifField('enabled', e.target.checked)}
                          />
                          <span className="notification-switch-slider" />
                        </label>
                      </div>

                      {/* Sound Alerts */}
                      <div className="notification-toggle-group">
                        <div className="notification-toggle-header">
                          <span className="material-icons">volume_up</span>
                          <div className="notification-toggle-text">
                            <span className="notification-toggle-label">Sound Alerts</span>
                            <span className="notification-toggle-description">
                              Play a sound with notifications
                            </span>
                          </div>
                        </div>
                        <label className="notification-switch">
                          <input
                            type="checkbox"
                            checked={notifState.soundEnabled}
                            onChange={(e) => updateNotifField('soundEnabled', e.target.checked)}
                            disabled={!notifState.enabled}
                          />
                          <span
                            className={`notification-switch-slider ${!notifState.enabled ? 'disabled' : ''}`}
                          />
                        </label>
                      </div>

                      {/* Notification Timing */}
                      <div className="notification-timing-section">
                        <div className="notification-timing-header">
                          <span className="material-icons">schedule</span>
                          <div className="notification-timing-text">
                            <span className="notification-timing-label">Notification Timing</span>
                            <span className="notification-timing-description">
                              Choose when to receive alerts before post time
                            </span>
                          </div>
                        </div>

                        <div className="notification-timing-options">
                          {NOTIFICATION_TIMING_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`notification-timing-chip ${notifState.timings.includes(option.value) ? 'selected' : ''}`}
                              onClick={() => toggleNotifTiming(option.value)}
                              disabled={!notifState.enabled}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        {notifState.timings.length === 0 && notifState.enabled && (
                          <p className="notification-timing-warning">
                            <span className="material-icons">warning</span>
                            Select at least one timing to receive alerts
                          </p>
                        )}
                      </div>

                      {/* Preview */}
                      <div className="notification-preview">
                        <div className="notification-preview-header">
                          <span className="material-icons">visibility</span>
                          <span>Preview</span>
                        </div>
                        <div className="notification-preview-content">
                          <div className="notification-preview-toast warning">
                            <span className="material-icons">timer</span>
                            <span>Race 3: 5 minutes until post time</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
  );
}

export default BankrollSettings;
