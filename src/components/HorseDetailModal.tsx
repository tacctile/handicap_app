import { useState, useEffect, useCallback, useMemo } from 'react'
import type { HorseEntry, RaceHeader } from '../types/drf'
import type { HorseScore, TacticalAdvantage, OverlayAnalysis } from '../lib/scoring'
import {
  SCORE_LIMITS,
  getScoreColor,
  parseRunningStyle,
  analyzePaceScenario,
  calculateTacticalAdvantage,
  PACE_SCENARIO_COLORS,
  analyzeOverlay,
  formatOverlayPercent,
  formatEV,
  formatEVPercent,
  getOverlayColor,
  getOverlayBgColor,
  VALUE_LABELS,
  VALUE_ICONS,
  extractEquipmentInfo,
  formatEquipmentChange,
  getTrainerProfile,
  // Class analysis imports
  formatClassMovement,
  getClassScoreColor,
  getClassMovementColor,
  getClassMovementIcon,
  getClassLevelName,
  getTierColor,
  getTierDisplayName,
} from '../lib/scoring'
import {
  getBreedingDisplayInfo,
  getExperienceBadge,
  getSireTierColor,
  BREEDING_CATEGORY_LIMITS,
} from '../lib/breeding'

interface HorseDetailModalProps {
  isOpen: boolean
  onClose: () => void
  horse: HorseEntry
  score: HorseScore
  raceHeader: RaceHeader
  currentOdds: string
  predictedPosition: number
  totalHorses: number
  /** All horses in the race for pace analysis */
  allHorses?: HorseEntry[]
  /** Pre-calculated overlay analysis */
  overlay?: OverlayAnalysis
}

// Material Icon component
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icons ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

// Progress bar component for score visualization
interface ScoreProgressProps {
  value: number
  max: number
  color: string
}

function ScoreProgress({ value, max, color }: ScoreProgressProps) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div className="score-progress-container">
      <div className="score-progress-bar">
        <div
          className="score-progress-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="score-progress-value" style={{ color }}>
        {value}/{max}
      </span>
    </div>
  )
}

// Category card component
interface CategoryCardProps {
  icon: string
  title: string
  score: number
  maxScore: number
  details: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
}

function CategoryCard({ icon, title, score, maxScore, details, isExpanded, onToggle }: CategoryCardProps) {
  const scoreColor = score >= maxScore * 0.7 ? '#36d1da' :
                     score >= maxScore * 0.5 ? '#19abb5' : '#888888'

  return (
    <div className={`category-card ${isExpanded ? 'expanded' : ''}`}>
      <button type="button" className="category-card-header" onClick={onToggle}>
        <div className="category-card-left">
          <Icon name={icon} className="category-icon" />
          <span className="category-title">{title}</span>
        </div>
        <div className="category-card-right">
          <div className="category-score-badge" style={{
            backgroundColor: `${scoreColor}20`,
            color: scoreColor,
            borderColor: `${scoreColor}40`
          }}>
            {score}
          </div>
          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="category-expand-icon" />
        </div>
      </button>
      {isExpanded && (
        <div className="category-card-content">
          <ScoreProgress value={score} max={maxScore} color={scoreColor} />
          <div className="category-details">
            {details}
          </div>
        </div>
      )}
    </div>
  )
}

// Key factor bullet
function KeyFactor({ icon, text, type = 'neutral' }: { icon: string; text: string; type?: 'strength' | 'weakness' | 'neutral' }) {
  const colorClass = type === 'strength' ? 'factor-strength' :
                     type === 'weakness' ? 'factor-weakness' : 'factor-neutral'

  return (
    <div className={`key-factor ${colorClass}`}>
      <Icon name={icon} className="factor-icon" />
      <span className="factor-text">{text}</span>
    </div>
  )
}

// Running style color helper
function getRunningStyleColor(style: string): string {
  switch (style) {
    case 'E': return '#ef4444'  // Red for early speed
    case 'P': return '#f97316'  // Orange for presser
    case 'C': return '#3b82f6'  // Blue for closer
    case 'S': return '#8b5cf6'  // Purple for sustained
    default: return '#888888'   // Gray for unknown
  }
}

// Tactical advantage level color
function getTacticalLevelColor(level: TacticalAdvantage['level']): string {
  switch (level) {
    case 'excellent': return '#22c55e'
    case 'good': return '#36d1da'
    case 'neutral': return '#888888'
    case 'poor': return '#f97316'
    case 'terrible': return '#ef4444'
  }
}

export function HorseDetailModal({
  isOpen,
  onClose,
  horse,
  score,
  raceHeader,
  currentOdds,
  predictedPosition,
  totalHorses,
  allHorses,
  overlay: overlayProp,
}: HorseDetailModalProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['connections']))
  const [isAnimating, setIsAnimating] = useState(false)

  // Handle modal animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }, [])

  // Calculate win probability based on position and score
  const winProbability = useMemo(() => {
    if (score.isScratched) return 0
    // Simple probability estimation based on score and field size
    const scoreRatio = score.total / SCORE_LIMITS.total
    const positionBonus = predictedPosition === 1 ? 0.15 :
                          predictedPosition === 2 ? 0.08 :
                          predictedPosition === 3 ? 0.04 : 0
    const fieldSizeAdjust = Math.min(0.5, 1 / totalHorses)
    const prob = Math.min(0.65, Math.max(0.02, scoreRatio * 0.4 + positionBonus + fieldSizeAdjust))
    return Math.round(prob * 100)
  }, [score, predictedPosition, totalHorses])

  // Enhanced pace analysis
  const paceAnalysis = useMemo(() => {
    const horsesToAnalyze = allHorses || [horse]
    const profile = parseRunningStyle(horse)
    const scenario = analyzePaceScenario(horsesToAnalyze)
    const tactical = calculateTacticalAdvantage(profile.style, scenario.scenario)

    return { profile, scenario, tactical }
  }, [horse, allHorses])

  // Overlay analysis - use prop if provided, otherwise calculate
  const overlay = useMemo(() => {
    if (overlayProp) return overlayProp
    return analyzeOverlay(score.total, currentOdds)
  }, [overlayProp, score.total, currentOdds])

  // Breeding analysis
  const breedingInfo = useMemo(() => {
    const displayInfo = getBreedingDisplayInfo(horse)
    const badge = getExperienceBadge(horse)
    return { ...displayInfo, badge }
  }, [horse])

  // Equipment analysis
  const equipmentAnalysis = useMemo(() => {
    const info = extractEquipmentInfo(horse)
    const trainerProfile = getTrainerProfile(horse.trainerName)
    return {
      ...info,
      trainerProfile,
    }
  }, [horse])

  // Generate key factors
  const keyFactors = useMemo(() => {
    const factors: { icon: string; text: string; type: 'strength' | 'weakness' | 'neutral' }[] = []
    const b = score.breakdown

    // Connections analysis
    if (b.connections.total >= SCORE_LIMITS.connections * 0.8) {
      factors.push({ icon: 'stars', text: 'Elite trainer/jockey combo', type: 'strength' })
    } else if (b.connections.total >= SCORE_LIMITS.connections * 0.6) {
      factors.push({ icon: 'person', text: 'Solid connections', type: 'neutral' })
    }

    // Post position analysis
    if (b.postPosition.trackBiasApplied) {
      if (b.postPosition.total >= SCORE_LIMITS.postPosition * 0.7) {
        factors.push({ icon: 'trending_up', text: 'Favorable post with track bias', type: 'strength' })
      } else if (b.postPosition.total < SCORE_LIMITS.postPosition * 0.3) {
        factors.push({ icon: 'trending_down', text: 'Disadvantaged post position', type: 'weakness' })
      }
    }

    // Speed figure / class analysis
    if (b.speedClass.total >= SCORE_LIMITS.speedClass * 0.8) {
      factors.push({ icon: 'bolt', text: 'Strong speed figures and proven at class', type: 'strength' })
    } else if (b.speedClass.total < SCORE_LIMITS.speedClass * 0.3) {
      factors.push({ icon: 'trending_flat', text: 'Below par speed figures or class rise', type: 'weakness' })
    }

    // Pace analysis - use enhanced tactical advantage
    if (paceAnalysis.tactical.level === 'excellent') {
      factors.push({ icon: 'speed', text: `Excellent pace fit: ${paceAnalysis.tactical.fit}`, type: 'strength' })
    } else if (paceAnalysis.tactical.level === 'good') {
      factors.push({ icon: 'speed', text: 'Good pace scenario fit', type: 'strength' })
    } else if (paceAnalysis.tactical.level === 'poor' || paceAnalysis.tactical.level === 'terrible') {
      factors.push({ icon: 'warning', text: `Poor pace fit: ${paceAnalysis.tactical.fit}`, type: 'weakness' })
    }

    // Form analysis
    if (b.form.total >= SCORE_LIMITS.form * 0.7) {
      factors.push({ icon: 'fitness_center', text: 'Sharp form', type: 'strength' })
    } else if (b.form.total < SCORE_LIMITS.form * 0.4) {
      factors.push({ icon: 'schedule', text: 'Form concerns', type: 'weakness' })
    }

    // Overlay / Value analysis
    if (overlay.overlayPercent >= 100) {
      factors.push({ icon: 'rocket_launch', text: `Massive ${formatOverlayPercent(overlay.overlayPercent)} overlay - exceptional value!`, type: 'strength' })
    } else if (overlay.overlayPercent >= 50) {
      factors.push({ icon: 'trending_up', text: `Strong ${formatOverlayPercent(overlay.overlayPercent)} overlay - excellent value`, type: 'strength' })
    } else if (overlay.overlayPercent >= 25) {
      factors.push({ icon: 'thumb_up', text: `Good ${formatOverlayPercent(overlay.overlayPercent)} overlay`, type: 'strength' })
    } else if (overlay.overlayPercent <= -20) {
      factors.push({ icon: 'do_not_disturb', text: `${formatOverlayPercent(overlay.overlayPercent)} underlay - avoid`, type: 'weakness' })
    }

    return factors
  }, [score.breakdown, paceAnalysis, overlay])

  if (!isOpen) return null

  const scoreColor = getScoreColor(score.total, score.isScratched)
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  return (
    <div
      className={`modal-overlay modal-overlay-responsive ${isAnimating ? 'animate-in' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="horse-modal-title"
    >
      <div className="horse-modal horse-modal-responsive">
        {/* Close button */}
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <Icon name="close" />
        </button>

        {/* Header Section - Responsive */}
        <header className="modal-header modal-header-responsive">
          <div className="modal-header-top modal-header-top-responsive">
            <div className="horse-identity horse-identity-responsive">
              <div className="horse-badges">
                <span className="program-badge">#{horse.programNumber}</span>
                <span className="post-badge">PP{horse.postPosition}</span>
              </div>
              <h2 id="horse-modal-title" className="horse-name-large">{horse.horseName}</h2>
            </div>

            <div className="score-display-large score-display-responsive">
              <div
                className="score-circle score-circle-responsive"
                style={{
                  borderColor: scoreColor,
                  color: scoreColor,
                  boxShadow: `0 0 20px ${scoreColor}30`
                }}
              >
                <span className="score-value">{score.isScratched ? '—' : score.total}</span>
                <span className="score-max">/{SCORE_LIMITS.total}</span>
              </div>
            </div>
          </div>

          <div className="modal-header-stats modal-header-stats-responsive">
            <div className="stat-pill stat-pill-responsive">
              <Icon name="emoji_events" className="stat-icon" />
              <span className="stat-label">Predicted</span>
              <span className="stat-value">{ordinal(predictedPosition)}</span>
            </div>
            <div className="stat-pill stat-pill-responsive highlight">
              <Icon name="percent" className="stat-icon" />
              <span className="stat-label">Win Prob</span>
              <span className="stat-value">{winProbability}%</span>
            </div>
            <div className="stat-pill stat-pill-responsive">
              <Icon name="paid" className="stat-icon" />
              <span className="stat-label">Odds</span>
              <span className="stat-value">{currentOdds}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Content - with mobile safe area */}
        <div className="modal-content modal-content-responsive">
          {/* Score Breakdown Section */}
          <section className="modal-section modal-section-responsive">
            <h3 className="section-title-modal">
              <Icon name="analytics" className="section-icon-modal" />
              Score Breakdown
            </h3>

            <div className="category-cards category-cards-responsive">
              <CategoryCard
                icon="people"
                title="Connections"
                score={score.breakdown.connections.total}
                maxScore={SCORE_LIMITS.connections}
                isExpanded={expandedCategories.has('connections')}
                onToggle={() => toggleCategory('connections')}
                details={
                  <div className="breakdown-details">
                    <div className="breakdown-row">
                      <span className="breakdown-label">Trainer Score</span>
                      <span className="breakdown-value">{score.breakdown.connections.trainer}/35</span>
                    </div>
                    <div className="breakdown-row">
                      <span className="breakdown-label">Jockey Score</span>
                      <span className="breakdown-value">{score.breakdown.connections.jockey}/15</span>
                    </div>
                    {score.breakdown.connections.partnershipBonus > 0 && (
                      <div className="breakdown-row">
                        <span className="breakdown-label">Elite Partnership Bonus</span>
                        <span className="breakdown-value" style={{ color: '#36d1da' }}>+{score.breakdown.connections.partnershipBonus}</span>
                      </div>
                    )}
                    <div className="breakdown-note">
                      Combined trainer + jockey rating
                    </div>
                  </div>
                }
              />

              <CategoryCard
                icon="grid_view"
                title="Post Position / Bias"
                score={score.breakdown.postPosition.total}
                maxScore={SCORE_LIMITS.postPosition}
                isExpanded={expandedCategories.has('postPosition')}
                onToggle={() => toggleCategory('postPosition')}
                details={
                  <div className="breakdown-details">
                    <div className="breakdown-row">
                      <span className="breakdown-label">Post Position</span>
                      <span className="breakdown-value">{horse.postPosition}</span>
                    </div>
                    <div className="breakdown-row">
                      <span className="breakdown-label">Track Bias Applied</span>
                      <span className="breakdown-value">
                        {score.breakdown.postPosition.trackBiasApplied ?
                          <Icon name="check_circle" className="text-sm text-accent" /> :
                          <Icon name="remove_circle_outline" className="text-sm" />
                        }
                      </span>
                    </div>
                    <div className="breakdown-note">
                      {score.breakdown.postPosition.reasoning}
                    </div>
                  </div>
                }
              />

              <CategoryCard
                icon="speed"
                title="Speed Figures / Class"
                score={score.breakdown.speedClass.total}
                maxScore={SCORE_LIMITS.speedClass}
                isExpanded={expandedCategories.has('speedClass')}
                onToggle={() => toggleCategory('speedClass')}
                details={
                  <div className="breakdown-details">
                    <div className="breakdown-row">
                      <span className="breakdown-label">Speed Score</span>
                      <span className="breakdown-value">{score.breakdown.speedClass.speedScore}/30</span>
                    </div>
                    <div className="breakdown-row">
                      <span className="breakdown-label">Class Score</span>
                      <span className="breakdown-value">{score.breakdown.speedClass.classScore}/20</span>
                    </div>
                    {score.breakdown.speedClass.bestFigure && (
                      <div className="breakdown-row">
                        <span className="breakdown-label">Best Recent Figure</span>
                        <span className="breakdown-value">{score.breakdown.speedClass.bestFigure}</span>
                      </div>
                    )}
                    <div className="breakdown-note">
                      {score.breakdown.speedClass.reasoning}
                    </div>
                    <div className="breakdown-hint">
                      Based on current odds as class indicator
                    </div>
                  </div>
                }
              />

              <CategoryCard
                icon="fitness_center"
                title="Form / Conditioning"
                score={score.breakdown.form.total}
                maxScore={SCORE_LIMITS.form}
                isExpanded={expandedCategories.has('form')}
                onToggle={() => toggleCategory('form')}
                details={
                  <div className="breakdown-details">
                    <div className="breakdown-row">
                      <span className="breakdown-label">Recent Form</span>
                      <span className="breakdown-value">{score.breakdown.form.recentFormScore}/15</span>
                    </div>
                    <div className="breakdown-row">
                      <span className="breakdown-label">Layoff</span>
                      <span className="breakdown-value">{score.breakdown.form.layoffScore}/10</span>
                    </div>
                    {score.breakdown.form.consistencyBonus > 0 && (
                      <div className="breakdown-row">
                        <span className="breakdown-label">Consistency Bonus</span>
                        <span className="breakdown-value" style={{ color: '#36d1da' }}>+{score.breakdown.form.consistencyBonus}</span>
                      </div>
                    )}
                    <div className="breakdown-note">
                      {score.breakdown.form.reasoning}
                    </div>
                  </div>
                }
              />

              <CategoryCard
                icon="build"
                title="Equipment / Medication"
                score={score.breakdown.equipment.total}
                maxScore={SCORE_LIMITS.equipment}
                isExpanded={expandedCategories.has('equipment')}
                onToggle={() => toggleCategory('equipment')}
                details={
                  <div className="breakdown-details">
                    {/* Equipment Changes List */}
                    {equipmentAnalysis.changes.length > 0 ? (
                      <>
                        <div className="breakdown-row" style={{ marginBottom: '8px' }}>
                          <span className="breakdown-label">Changes Detected</span>
                          <span className="breakdown-value" style={{ color: '#36d1da' }}>
                            {equipmentAnalysis.changes.length}
                          </span>
                        </div>
                        {equipmentAnalysis.changes.map((change, i) => {
                          const formatted = formatEquipmentChange(change)
                          return (
                            <div key={i} className="breakdown-row" style={{
                              backgroundColor: `${formatted.color}10`,
                              padding: '6px 8px',
                              borderRadius: '6px',
                              marginBottom: '4px',
                              border: `1px solid ${formatted.color}30`
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="material-icons text-sm" style={{ color: formatted.color }}>{formatted.icon}</span>
                                <span style={{ color: '#e0e0e0' }}>{formatted.label}</span>
                              </span>
                              <span className="breakdown-value" style={{ color: formatted.color, fontWeight: 600 }}>
                                {formatted.points} pts
                              </span>
                            </div>
                          )
                        })}
                        {/* Trainer Pattern Evidence */}
                        {equipmentAnalysis.trainerProfile && (
                          <div style={{
                            marginTop: '8px',
                            padding: '8px',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '6px',
                            border: '1px solid #333'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span className="material-icons text-sm" style={{ color: '#f59e0b' }}>star</span>
                              <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>
                                Trainer Pattern Active
                              </span>
                            </div>
                            <span style={{ color: '#888', fontSize: '0.75rem' }}>
                              {horse.trainerName} has {equipmentAnalysis.trainerProfile.patterns.length} tracked equipment patterns
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="breakdown-row">
                        <span className="breakdown-label">Status</span>
                        <span className="breakdown-value" style={{ color: '#888' }}>
                          No equipment changes
                        </span>
                      </div>
                    )}

                    {/* Current Equipment */}
                    {equipmentAnalysis.currentEquipment && (
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ color: '#888', fontSize: '0.75rem' }}>Current: </span>
                        <span style={{ color: '#e0e0e0', fontSize: '0.75rem' }}>
                          {equipmentAnalysis.currentEquipment || 'None listed'}
                        </span>
                      </div>
                    )}

                    {/* Last Race Equipment */}
                    {equipmentAnalysis.lastRaceEquipment && (
                      <div>
                        <span style={{ color: '#888', fontSize: '0.75rem' }}>Last race: </span>
                        <span style={{ color: '#e0e0e0', fontSize: '0.75rem' }}>
                          {equipmentAnalysis.lastRaceEquipment}
                        </span>
                      </div>
                    )}

                    <div className="breakdown-note" style={{ marginTop: '8px' }}>
                      {score.breakdown.equipment.reasoning}
                    </div>
                  </div>
                }
              />

              <CategoryCard
                icon="timeline"
                title="Pace / Tactical"
                score={score.breakdown.pace.total}
                maxScore={SCORE_LIMITS.pace}
                isExpanded={expandedCategories.has('pace')}
                onToggle={() => toggleCategory('pace')}
                details={
                  <div className="breakdown-details">
                    {/* Running Style */}
                    <div className="breakdown-row">
                      <span className="breakdown-label">Running Style</span>
                      <span
                        className="breakdown-value"
                        style={{ color: getRunningStyleColor(paceAnalysis.profile.style) }}
                      >
                        {paceAnalysis.profile.styleName}
                      </span>
                    </div>

                    {/* Style Evidence */}
                    <div className="breakdown-row">
                      <span className="breakdown-label">Evidence</span>
                      <span className="breakdown-value">
                        {paceAnalysis.profile.stats.timesOnLead}/{paceAnalysis.profile.stats.totalRaces} led early
                      </span>
                    </div>

                    {/* Pace Scenario */}
                    <div className="breakdown-row">
                      <span className="breakdown-label">Pace Scenario</span>
                      <span
                        className="breakdown-value"
                        style={{ color: PACE_SCENARIO_COLORS[paceAnalysis.scenario.scenario] }}
                      >
                        {paceAnalysis.scenario.label}
                      </span>
                    </div>

                    {/* PPI */}
                    <div className="breakdown-row">
                      <span className="breakdown-label">Pace Pressure Index</span>
                      <span className="breakdown-value">{paceAnalysis.scenario.ppi}%</span>
                    </div>

                    {/* Tactical Advantage */}
                    <div className="breakdown-row">
                      <span className="breakdown-label">Tactical Advantage</span>
                      <span
                        className="breakdown-value"
                        style={{ color: getTacticalLevelColor(paceAnalysis.tactical.level) }}
                      >
                        +{paceAnalysis.tactical.points} pts ({paceAnalysis.tactical.level})
                      </span>
                    </div>

                    {/* Pace Fit */}
                    <div className="breakdown-row">
                      <span className="breakdown-label">Pace Fit</span>
                      <span className="breakdown-value" style={{
                        color: score.breakdown.pace.paceFit === 'perfect' ? '#36d1da' :
                               score.breakdown.pace.paceFit === 'good' ? '#19abb5' :
                               score.breakdown.pace.paceFit === 'poor' ? '#ff6b6b' : 'inherit'
                      }}>
                        {score.breakdown.pace.paceFit.charAt(0).toUpperCase() + score.breakdown.pace.paceFit.slice(1)}
                      </span>
                    </div>

                    <div className="breakdown-note">
                      {paceAnalysis.tactical.reasoning}
                    </div>
                  </div>
                }
              />
            </div>
          </section>

          {/* Class Analysis Section */}
          {score.classScore && (
            <section className="modal-section">
              <h3 className="section-title-modal">
                <Icon name="leaderboard" className="section-icon-modal" />
                Class Analysis
                {score.breakdown.classAnalysis?.isValuePlay && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#22c55e20',
                    color: '#22c55e',
                    marginLeft: '8px',
                    fontWeight: 600,
                  }}>
                    VALUE PLAY
                  </span>
                )}
              </h3>

              <div className="class-analysis-box" style={{
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #333',
              }}>
                {/* Class Movement Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <span style={{
                      fontSize: '1.5rem',
                      color: getClassMovementColor(score.classScore.analysis.movement.direction),
                    }}>
                      {getClassMovementIcon(score.classScore.analysis.movement.direction)}
                    </span>
                    <div>
                      <div style={{
                        color: getClassMovementColor(score.classScore.analysis.movement.direction),
                        fontWeight: 600,
                        fontSize: '1rem',
                      }}>
                        {score.classScore.analysis.movement.direction === 'drop' ? 'Class Drop' :
                         score.classScore.analysis.movement.direction === 'rise' ? 'Class Rise' :
                         score.classScore.analysis.movement.direction === 'lateral' ? 'Same Class' : 'First Start'}
                      </div>
                      <div style={{ color: '#888', fontSize: '0.85rem' }}>
                        {formatClassMovement(score.classScore.analysis)}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: `${getClassScoreColor(score.classScore.total)}20`,
                    color: getClassScoreColor(score.classScore.total),
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                  }}>
                    {score.classScore.total}/20
                  </div>
                </div>

                {/* Current vs Last Race Class */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    backgroundColor: '#222',
                    padding: '10px 12px',
                    borderRadius: '8px',
                  }}>
                    <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }}>Current Race</div>
                    <div style={{ color: '#e0e0e0', fontWeight: 600 }}>
                      {getClassLevelName(score.classScore.analysis.currentClass)}
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: '#222',
                    padding: '10px 12px',
                    borderRadius: '8px',
                  }}>
                    <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }}>Last Race</div>
                    <div style={{ color: '#e0e0e0', fontWeight: 600 }}>
                      {score.classScore.analysis.lastRaceClass
                        ? getClassLevelName(score.classScore.analysis.lastRaceClass)
                        : 'First Start'}
                    </div>
                  </div>
                </div>

                {/* Proven at Level */}
                {score.classScore.analysis.provenAtLevel && (
                  <div style={{
                    backgroundColor: '#222',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}>
                      <span style={{ color: '#36d1da' }}><Icon name="verified" className="text-sm" /></span>
                      <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '0.9rem' }}>
                        Proven at Level
                      </span>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      fontSize: '0.8rem',
                    }}>
                      <div>
                        <span style={{ color: '#888' }}>Wins: </span>
                        <span style={{
                          color: score.classScore.analysis.provenAtLevel.winsAtLevel > 0 ? '#22c55e' : '#e0e0e0'
                        }}>
                          {score.classScore.analysis.provenAtLevel.winsAtLevel}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#888' }}>ITM: </span>
                        <span style={{
                          color: score.classScore.analysis.provenAtLevel.itmAtLevel > 0 ? '#36d1da' : '#e0e0e0'
                        }}>
                          {score.classScore.analysis.provenAtLevel.itmAtLevel}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#888' }}>Competitive: </span>
                        <span style={{ color: '#e0e0e0' }}>
                          {score.classScore.analysis.provenAtLevel.competitiveRacesAtLevel}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hidden Class Drops - CRITICAL value indicators */}
                {score.classScore.analysis.hiddenDrops.length > 0 && (
                  <div style={{
                    backgroundColor: '#1a2e1a',
                    border: '1px solid #22c55e40',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '10px',
                    }}>
                      <span style={{ color: '#22c55e' }}><Icon name="trending_down" className="text-sm" /></span>
                      <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.9rem' }}>
                        Hidden Class Drops Detected
                      </span>
                      <span style={{
                        backgroundColor: '#22c55e20',
                        color: '#22c55e',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}>
                        +{score.classScore.hiddenDropsScore} pts
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {score.classScore.analysis.hiddenDrops.map((drop, i) => (
                        <div key={i} style={{
                          backgroundColor: '#222',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #333',
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}>
                            <span style={{ color: '#e0e0e0', fontSize: '0.85rem', fontWeight: 500 }}>
                              {drop.description}
                            </span>
                            <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 600 }}>
                              +{drop.pointsBonus} pts
                            </span>
                          </div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>
                            {drop.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Track Tier Movement */}
                {score.classScore.analysis.trackTierMovement && (
                  <div style={{
                    backgroundColor: '#222',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}>
                      <span style={{ color: '#f59e0b' }}><Icon name="location_on" className="text-sm" /></span>
                      <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '0.9rem' }}>
                        Track Tier Movement
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.85rem',
                    }}>
                      <span style={{
                        backgroundColor: `${getTierColor(score.classScore.analysis.trackTierMovement.fromTier)}20`,
                        color: getTierColor(score.classScore.analysis.trackTierMovement.fromTier),
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}>
                        {score.classScore.analysis.trackTierMovement.fromTrack} ({getTierDisplayName(score.classScore.analysis.trackTierMovement.fromTier)})
                      </span>
                      <span style={{ color: '#888' }}><Icon name="arrow_forward" className="text-sm" /></span>
                      <span style={{
                        backgroundColor: `${getTierColor(score.classScore.analysis.trackTierMovement.toTier)}20`,
                        color: getTierColor(score.classScore.analysis.trackTierMovement.toTier),
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}>
                        {score.classScore.analysis.trackTierMovement.toTrack} ({getTierDisplayName(score.classScore.analysis.trackTierMovement.toTier)})
                      </span>
                      {score.classScore.analysis.trackTierMovement.pointsAdjustment !== 0 && (
                        <span style={{
                          color: score.classScore.analysis.trackTierMovement.pointsAdjustment > 0 ? '#22c55e' : '#ef4444',
                          fontWeight: 600,
                        }}>
                          {score.classScore.analysis.trackTierMovement.pointsAdjustment > 0 ? '+' : ''}
                          {score.classScore.analysis.trackTierMovement.pointsAdjustment} pts
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Score Breakdown */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  fontSize: '0.8rem',
                }}>
                  <div style={{
                    backgroundColor: '#222',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#888' }}>Proven at Level</span>
                    <span style={{ color: '#e0e0e0' }}>{score.classScore.provenAtLevelScore}</span>
                  </div>
                  <div style={{
                    backgroundColor: '#222',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#888' }}>Class Movement</span>
                    <span style={{ color: '#e0e0e0' }}>{score.classScore.classMovementScore}</span>
                  </div>
                  <div style={{
                    backgroundColor: '#222',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#888' }}>Hidden Drops</span>
                    <span style={{ color: score.classScore.hiddenDropsScore > 0 ? '#22c55e' : '#e0e0e0' }}>
                      {score.classScore.hiddenDropsScore > 0 ? '+' : ''}{score.classScore.hiddenDropsScore}
                    </span>
                  </div>
                  <div style={{
                    backgroundColor: '#222',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#888' }}>Track Tier</span>
                    <span style={{ color: '#e0e0e0' }}>{score.classScore.trackTierScore}</span>
                  </div>
                </div>

                {/* Reasoning */}
                <div style={{
                  marginTop: '12px',
                  color: '#888',
                  fontSize: '0.8rem',
                  fontStyle: 'italic',
                }}>
                  {score.classScore.reasoning}
                </div>
              </div>
            </section>
          )}

          {/* Breeding Section */}
          <section className="modal-section">
            <h3 className="section-title-modal">
              <Icon name="family_restroom" className="section-icon-modal" />
              Breeding {breedingInfo.showBreedingScore && score.breedingScore?.wasApplied && (
                <span style={{
                  fontSize: '0.75rem',
                  color: score.breedingScore.total >= 40 ? '#22c55e' : score.breedingScore.total >= 30 ? '#36d1da' : '#888888',
                  marginLeft: '8px'
                }}>
                  +{score.breakdown.breeding?.contribution || 0} pts
                </span>
              )}
            </h3>

            <div className="breeding-info-box">
              {/* Experience Badge */}
              <div className="breeding-experience-row">
                <span
                  className="breeding-experience-badge"
                  style={{
                    backgroundColor: breedingInfo.badge.bgColor,
                    color: breedingInfo.badge.color,
                    borderColor: `${breedingInfo.badge.color}40`,
                  }}
                >
                  <Icon name={breedingInfo.experienceLevel === 'debut' ? 'star' : breedingInfo.experienceLevel === 'lightly_raced' ? 'trending_up' : 'verified'} className="text-sm" />
                  {breedingInfo.badge.text}
                </span>
                {breedingInfo.showBreedingScore && score.breedingScore?.wasApplied && (
                  <span className="breeding-analysis-indicator" style={{ color: '#36d1da' }}>
                    <Icon name="insights" className="text-sm" />
                    Breeding analysis active
                  </span>
                )}
              </div>

              {/* Pedigree Grid with Scores */}
              <div className="breeding-pedigree-grid">
                <div className="breeding-pedigree-item">
                  <span className="breeding-label">Sire</span>
                  <span className="breeding-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {breedingInfo.sire}
                    {score.breedingScore?.sireDetails.profile && (
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: `${getSireTierColor(score.breedingScore.sireDetails.profile.tier)}20`,
                        color: getSireTierColor(score.breedingScore.sireDetails.profile.tier),
                      }}>
                        {score.breedingScore.sireDetails.tierLabel}
                      </span>
                    )}
                  </span>
                </div>
                <div className="breeding-pedigree-item">
                  <span className="breeding-label">Dam</span>
                  <span className="breeding-value">{breedingInfo.dam}</span>
                </div>
                <div className="breeding-pedigree-item">
                  <span className="breeding-label">Damsire</span>
                  <span className="breeding-value">{breedingInfo.damsire}</span>
                </div>
                <div className="breeding-pedigree-item">
                  <span className="breeding-label">Where Bred</span>
                  <span className="breeding-value">{breedingInfo.whereBred}</span>
                </div>
              </div>

              {/* Breeding Score Breakdown (for lightly raced horses) */}
              {breedingInfo.showBreedingScore && score.breedingScore?.wasApplied && (
                <div className="breeding-score-breakdown" style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '8px',
                  border: '1px solid #333'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 600, color: '#e0e0e0' }}>Breeding Score</span>
                    <span style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: score.breedingScore.total >= 40 ? '#22c55e' : score.breedingScore.total >= 30 ? '#36d1da' : '#888888'
                    }}>
                      {score.breedingScore.total}/{BREEDING_CATEGORY_LIMITS.total}
                    </span>
                  </div>

                  {/* Score breakdown bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>Sire</span>
                      <span style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                        {score.breedingScore.breakdown.sireScore}/{BREEDING_CATEGORY_LIMITS.sire}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>Dam</span>
                      <span style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                        {score.breedingScore.breakdown.damScore}/{BREEDING_CATEGORY_LIMITS.dam}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>Damsire</span>
                      <span style={{ color: '#e0e0e0', fontSize: '0.85rem' }}>
                        {score.breedingScore.breakdown.damsireScore}/{BREEDING_CATEGORY_LIMITS.damsire}
                      </span>
                    </div>
                    {score.breedingScore.bonuses.total > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#36d1da', fontSize: '0.85rem' }}>Bonuses</span>
                        <span style={{ color: '#36d1da', fontSize: '0.85rem' }}>
                          +{score.breedingScore.bonuses.total}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contribution to overall score */}
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>
                      Contributing to overall score
                    </span>
                    <span style={{ color: '#36d1da', fontWeight: 600, fontSize: '0.9rem' }}>
                      +{score.breakdown.breeding?.contribution || 0} pts
                    </span>
                  </div>

                  {/* Sire details if known */}
                  {score.breedingScore.sireDetails.profile && (
                    <div style={{
                      marginTop: '12px',
                      padding: '10px',
                      backgroundColor: '#222',
                      borderRadius: '6px',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{ color: '#e0e0e0', fontWeight: 600, marginBottom: '6px' }}>
                        {score.breedingScore.sireDetails.profile.name} Stats
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', color: '#888' }}>
                        <span>Win Rate: <span style={{ color: '#e0e0e0' }}>{score.breedingScore.sireDetails.profile.winRate.toFixed(1)}%</span></span>
                        <span>$/Start: <span style={{ color: '#e0e0e0' }}>${(score.breedingScore.sireDetails.profile.earningsPerStart / 1000).toFixed(0)}K</span></span>
                        <span>Surface: <span style={{ color: '#e0e0e0' }}>{score.breedingScore.sireDetails.profile.surfacePreference}</span></span>
                        <span>Distance: <span style={{ color: '#e0e0e0' }}>{score.breedingScore.sireDetails.profile.distancePreference.category}</span></span>
                        <span>FTS Win%: <span style={{ color: '#e0e0e0' }}>{score.breedingScore.sireDetails.profile.firstTimeStarterWinRate.toFixed(1)}%</span></span>
                      </div>
                    </div>
                  )}

                  {/* Why this matters explanation */}
                  <div style={{
                    marginTop: '10px',
                    fontSize: '0.75rem',
                    color: '#666',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '4px'
                  }}>
                    <Icon name="info" className="text-sm" />
                    <span>
                      {breedingInfo.starts === 0
                        ? 'Debut runners have no race form, so breeding data helps project potential ability.'
                        : `With only ${breedingInfo.starts} start${breedingInfo.starts === 1 ? '' : 's'}, breeding helps fill gaps in race data.`
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Experience Details (for experienced horses) */}
              {!breedingInfo.showBreedingScore && (
                <div className="breeding-experience-details" style={{ marginTop: '12px' }}>
                  <div className="breeding-starts-row" style={{ color: '#888', fontSize: '0.85rem' }}>
                    <Icon name="verified" className="text-sm" />
                    <span>
                      {breedingInfo.starts} lifetime starts - race form data used for scoring
                    </span>
                  </div>
                </div>
              )}

              {/* Lightly raced but breeding not applied */}
              {breedingInfo.showBreedingScore && !score.breedingScore?.wasApplied && (
                <div className="breeding-experience-details" style={{ marginTop: '12px' }}>
                  <div className="breeding-starts-row" style={{ color: '#888', fontSize: '0.85rem' }}>
                    <Icon name="history" className="text-sm" />
                    <span>
                      {breedingInfo.starts === 0
                        ? 'Making career debut - no race history'
                        : breedingInfo.starts === 1
                        ? '1 lifetime start - limited form data'
                        : `${breedingInfo.starts} lifetime starts`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Overlay & Value Analysis Section */}
          <section className="modal-section">
            <h3 className="section-title-modal">
              <Icon name="attach_money" className="section-icon-modal" />
              Value Analysis
            </h3>

            <div className="overlay-analysis-box">
              {/* Main overlay badge */}
              <div
                className="overlay-main-badge"
                style={{
                  backgroundColor: getOverlayBgColor(overlay.overlayPercent, 0.15),
                  borderColor: `${getOverlayColor(overlay.overlayPercent)}40`,
                }}
              >
                <div className="overlay-main-header">
                  <span
                    className="material-icons overlay-main-icon"
                    style={{ color: getOverlayColor(overlay.overlayPercent) }}
                  >
                    {VALUE_ICONS[overlay.valueClass]}
                  </span>
                  <span
                    className="overlay-main-percent"
                    style={{ color: getOverlayColor(overlay.overlayPercent) }}
                  >
                    {formatOverlayPercent(overlay.overlayPercent)}
                  </span>
                  <span className="overlay-main-label">
                    {VALUE_LABELS[overlay.valueClass]}
                  </span>
                </div>
                <p className="overlay-main-description">{overlay.overlayDescription}</p>
              </div>

              {/* Detailed breakdown */}
              <div className="overlay-details-grid">
                <div className="overlay-detail-item">
                  <span className="overlay-detail-label">Your Win Probability</span>
                  <span className="overlay-detail-value highlight">
                    {overlay.winProbability.toFixed(1)}%
                  </span>
                </div>
                <div className="overlay-detail-item">
                  <span className="overlay-detail-label">Fair Odds (based on score)</span>
                  <span className="overlay-detail-value">{overlay.fairOddsDisplay}</span>
                </div>
                <div className="overlay-detail-item">
                  <span className="overlay-detail-label">Actual Odds</span>
                  <span className="overlay-detail-value">{currentOdds}</span>
                </div>
                <div className="overlay-detail-item">
                  <span className="overlay-detail-label">Expected Value (per $1)</span>
                  <span
                    className="overlay-detail-value"
                    style={{ color: overlay.evPerDollar >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {formatEV(overlay.evPerDollar)}
                  </span>
                </div>
              </div>

              {/* Recommendation box */}
              <div
                className="overlay-recommendation-box"
                style={{
                  borderColor: overlay.recommendation.action === 'bet_heavily' ? '#22c55e' :
                               overlay.recommendation.action === 'bet_standard' ? '#3b82f6' :
                               overlay.recommendation.action === 'avoid' ? '#ef4444' : '#6b7280',
                }}
              >
                <div className="overlay-rec-header">
                  <Icon
                    name={
                      overlay.recommendation.action === 'bet_heavily' ? 'rocket_launch' :
                      overlay.recommendation.action === 'bet_standard' ? 'check_circle' :
                      overlay.recommendation.action === 'bet_small' ? 'thumb_up' :
                      overlay.recommendation.action === 'avoid' ? 'cancel' : 'remove_circle'
                    }
                    className="overlay-rec-icon"
                  />
                  <span className="overlay-rec-action">
                    {overlay.recommendation.action === 'bet_heavily' ? 'Bet Heavily' :
                     overlay.recommendation.action === 'bet_standard' ? 'Standard Bet' :
                     overlay.recommendation.action === 'bet_small' ? 'Small Bet' :
                     overlay.recommendation.action === 'avoid' ? 'Avoid' : 'Pass'}
                  </span>
                  {overlay.recommendation.urgency === 'immediate' && (
                    <span className="overlay-urgency-badge">IMMEDIATE</span>
                  )}
                </div>
                <p className="overlay-rec-reasoning">{overlay.recommendation.reasoning}</p>
                {overlay.recommendation.suggestedMultiplier > 0 && overlay.recommendation.action !== 'avoid' && (
                  <div className="overlay-bet-multiplier">
                    <span>Suggested: </span>
                    <strong>{overlay.recommendation.suggestedMultiplier.toFixed(1)}x</strong>
                    <span> standard unit</span>
                  </div>
                )}
              </div>

              {/* EV explanation */}
              <div className="overlay-ev-explanation">
                <Icon name="info" className="text-sm" />
                <span>
                  {overlay.isPositiveEV
                    ? `Positive EV bet: Expected to return ${formatEVPercent(overlay.evPercent)} on investment long-term.`
                    : 'Negative EV: This bet is not profitable long-term at current odds.'}
                </span>
              </div>
            </div>
          </section>

          {/* Key Factors Section */}
          <section className="modal-section">
            <h3 className="section-title-modal">
              <Icon name="lightbulb" className="section-icon-modal" />
              Key Factors
            </h3>

            <div className="key-factors-list">
              {keyFactors.length > 0 ? (
                keyFactors.map((factor, i) => (
                  <KeyFactor key={i} icon={factor.icon} text={factor.text} type={factor.type} />
                ))
              ) : (
                <KeyFactor icon="info" text="Average profile - no standout factors" type="neutral" />
              )}
            </div>

            {/* Enhanced Pace Analysis Box */}
            <div className="pace-scenario-box">
              <div className="pace-scenario-header">
                <Icon name="directions_run" className="pace-scenario-icon" />
                <span>Running Style Analysis</span>
              </div>
              <div className="pace-scenario-content">
                <div
                  className="running-style-badge"
                  style={{
                    backgroundColor: `${getRunningStyleColor(paceAnalysis.profile.style)}20`,
                    color: getRunningStyleColor(paceAnalysis.profile.style),
                    borderColor: `${getRunningStyleColor(paceAnalysis.profile.style)}40`,
                  }}
                >
                  {paceAnalysis.profile.styleName}
                </div>
                <p className="pace-scenario-desc">
                  {paceAnalysis.profile.description}
                </p>
              </div>

              {/* Pace Scenario Fit */}
              <div className="pace-fit-section">
                <div className="pace-fit-header">
                  <span
                    className="material-icons pace-fit-icon"
                    style={{ color: PACE_SCENARIO_COLORS[paceAnalysis.scenario.scenario] }}
                  >
                    {paceAnalysis.scenario.scenario === 'soft' ? 'trending_flat' :
                     paceAnalysis.scenario.scenario === 'moderate' ? 'trending_up' :
                     paceAnalysis.scenario.scenario === 'contested' ? 'local_fire_department' :
                     paceAnalysis.scenario.scenario === 'speed_duel' ? 'whatshot' : 'help_outline'}
                  </span>
                  <span className="pace-fit-label">Scenario Fit</span>
                </div>
                <div
                  className="pace-fit-badge"
                  style={{
                    backgroundColor: `${getTacticalLevelColor(paceAnalysis.tactical.level)}20`,
                    color: getTacticalLevelColor(paceAnalysis.tactical.level),
                    borderColor: `${getTacticalLevelColor(paceAnalysis.tactical.level)}40`,
                  }}
                >
                  {paceAnalysis.tactical.fit}
                </div>
                <div className="pace-fit-points">
                  <span className="points-label">Tactical Points:</span>
                  <span
                    className="points-value"
                    style={{ color: getTacticalLevelColor(paceAnalysis.tactical.level) }}
                  >
                    +{paceAnalysis.tactical.points}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* DRF Data Section */}
          <section className="modal-section">
            <h3 className="section-title-modal">
              <Icon name="description" className="section-icon-modal" />
              Race Data
            </h3>

            <div className="drf-data-grid">
              <div className="drf-data-item">
                <span className="drf-label">Trainer</span>
                <span className="drf-value">{horse.trainerName}</span>
              </div>
              <div className="drf-data-item">
                <span className="drf-label">Jockey</span>
                <span className="drf-value">{horse.jockeyName}</span>
              </div>
              <div className="drf-data-item">
                <span className="drf-label">M/L Odds</span>
                <span className="drf-value highlight">{horse.morningLineOdds}</span>
              </div>
              <div className="drf-data-item">
                <span className="drf-label">Current Odds</span>
                <span className="drf-value highlight">{currentOdds}</span>
              </div>
              <div className="drf-data-item">
                <span className="drf-label">Distance</span>
                <span className="drf-value">{raceHeader.distance}</span>
              </div>
              <div className="drf-data-item">
                <span className="drf-label">Surface</span>
                <span className="drf-value capitalize">{raceHeader.surface}</span>
              </div>
            </div>

            <div className="drf-race-context">
              <Icon name="location_on" className="text-primary" />
              <span>{raceHeader.trackCode} - Race {raceHeader.raceNumber}</span>
              <span className="drf-date">{raceHeader.raceDate}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
