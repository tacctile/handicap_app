import { useState, useEffect, useCallback, useMemo } from 'react'
import type { HorseEntry, RaceHeader } from '../types/drf'
import type { HorseScore } from '../lib/scoring'
import { SCORE_LIMITS, getScoreColor } from '../lib/scoring'

interface HorseDetailModalProps {
  isOpen: boolean
  onClose: () => void
  horse: HorseEntry
  score: HorseScore
  raceHeader: RaceHeader
  currentOdds: string
  predictedPosition: number
  totalHorses: number
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

export function HorseDetailModal({
  isOpen,
  onClose,
  horse,
  score,
  raceHeader,
  currentOdds,
  predictedPosition,
  totalHorses,
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

    // Pace analysis
    if (b.pace.total >= SCORE_LIMITS.pace * 0.7) {
      factors.push({ icon: 'speed', text: 'Good pace scenario fit', type: 'strength' })
    }

    // Form analysis
    if (b.form.total >= SCORE_LIMITS.form * 0.7) {
      factors.push({ icon: 'fitness_center', text: 'Sharp form', type: 'strength' })
    } else if (b.form.total < SCORE_LIMITS.form * 0.4) {
      factors.push({ icon: 'schedule', text: 'Form concerns', type: 'weakness' })
    }

    return factors
  }, [score.breakdown])

  // Get running style description for Key Factors section
  const runningStyleDesc = useMemo(() => {
    const style = score.breakdown.pace.runningStyle
    if (style === 'Early Speed' || style === 'E') return 'Prefers to be on or near the lead'
    if (style === 'Early Presser' || style === 'EP') return 'Can rate behind speed and pounce'
    if (style === 'Presser' || style === 'P') return 'Stalks the pace and makes a timely move'
    if (style === 'Stalker' || style === 'S') return 'Rates mid-pack and rallies'
    if (style === 'Closer' || style === 'C') return 'Comes from off the pace in the stretch'
    return 'Running style unknown'
  }, [score.breakdown.pace.runningStyle])

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
                    {score.breakdown.equipment.hasChanges && (
                      <div className="breakdown-row">
                        <span className="breakdown-label">Equipment Change</span>
                        <span className="breakdown-value" style={{ color: '#36d1da' }}>
                          <Icon name="star" className="text-sm" /> Active
                        </span>
                      </div>
                    )}
                    <div className="breakdown-note">
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
                    <div className="breakdown-row">
                      <span className="breakdown-label">Running Style</span>
                      <span className="breakdown-value">{score.breakdown.pace.runningStyle}</span>
                    </div>
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
                      {score.breakdown.pace.reasoning}
                    </div>
                  </div>
                }
              />
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

            <div className="pace-scenario-box">
              <div className="pace-scenario-header">
                <Icon name="directions_run" className="pace-scenario-icon" />
                <span>Running Style Analysis</span>
              </div>
              <div className="pace-scenario-content">
                <div className="running-style-badge">{score.breakdown.pace.runningStyle}</div>
                <p className="pace-scenario-desc">{runningStyleDesc}</p>
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
