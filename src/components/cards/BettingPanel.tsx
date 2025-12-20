import { motion } from 'framer-motion'
import { TrophyIllustration } from '../../assets/illustrations'
import { StaggerContainer, StaggerItem, ConfidenceMeter, Skeleton } from '../motion'

interface BettingPanelProps {
  recommendations?: {
    tier1?: { horses: string[]; confidence: number }
    tier2?: { horses: string[]; confidence: number }
    tier3?: { horses: string[]; confidence: number }
  }
  overallConfidence?: number
  isLoading?: boolean
}

interface TierConfig {
  id: 'tier1' | 'tier2' | 'tier3'
  label: string
  sublabel: string
  icon: string
  colorClass: string
  winRate: string
}

const tiers: TierConfig[] = [
  {
    id: 'tier1',
    label: 'Tier 1',
    sublabel: 'Cover Chalk',
    icon: 'military_tech',
    colorClass: 'tier-gold',
    winRate: '35% Win Rate',
  },
  {
    id: 'tier2',
    label: 'Tier 2',
    sublabel: 'Logical Alternatives',
    icon: 'stars',
    colorClass: 'tier-silver',
    winRate: '18% Win Rate',
  },
  {
    id: 'tier3',
    label: 'Tier 3',
    sublabel: 'Value Bombs',
    icon: 'bolt',
    colorClass: 'tier-bronze',
    winRate: '8% Win Rate',
  },
]

export function BettingPanel({ recommendations, overallConfidence = 0, isLoading }: BettingPanelProps) {
  const hasData = !!recommendations?.tier1?.horses?.length

  if (isLoading) {
    return (
      <div className="betting-panel loading">
        <div className="betting-panel-header">
          <Skeleton width="150px" height="24px" />
          <Skeleton width="100px" height="20px" />
        </div>
        <div className="betting-panel-tiers">
          {[1, 2, 3].map((i) => (
            <div key={i} className="betting-tier-skeleton">
              <Skeleton width="100%" height="80px" className="rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className={`betting-panel ${hasData ? 'has-data' : 'empty'}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
    >
      {/* Panel header */}
      <div className="betting-panel-header">
        <div className="betting-panel-title">
          <span className="material-icons">analytics</span>
          <h3>Betting Recommendations</h3>
        </div>
        <div className="betting-panel-actions">
          <button className="betting-export-btn" disabled={!hasData} title="Available in Pro">
            <span className="material-icons">file_download</span>
            <span className="export-text">Export</span>
            <span className="pro-badge">Pro</span>
          </button>
        </div>
      </div>

      {/* Overall confidence */}
      <div className="betting-confidence-section">
        <div className="betting-confidence-header">
          <span className="confidence-label">Overall Confidence</span>
          <span className="confidence-value">{hasData ? `${overallConfidence}%` : '0%'}</span>
        </div>
        <ConfidenceMeter value={hasData ? overallConfidence : 0} className="betting-confidence-meter" />
      </div>

      {/* Tier badges */}
      <StaggerContainer className="betting-tiers">
        {tiers.map((tier) => {
          const tierData = recommendations?.[tier.id]
          const hasTierData = !!tierData?.horses?.length

          return (
            <StaggerItem key={tier.id}>
              <motion.div
                className={`betting-tier ${tier.colorClass} ${hasTierData ? 'active' : 'inactive'}`}
                whileHover={hasTierData ? { scale: 1.02 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="tier-header">
                  <div className="tier-icon-wrapper">
                    <span className="material-icons tier-icon">{tier.icon}</span>
                  </div>
                  <div className="tier-info">
                    <span className="tier-label">{tier.label}</span>
                    <span className="tier-sublabel">{tier.sublabel}</span>
                  </div>
                  <div className="tier-win-rate">{tier.winRate}</div>
                </div>

                <div className="tier-content">
                  {hasTierData ? (
                    <>
                      <div className="tier-horses">
                        {tierData!.horses.map((horse, i) => (
                          <span key={i} className="tier-horse-tag">
                            {horse}
                          </span>
                        ))}
                      </div>
                      <div className="tier-confidence">
                        <ConfidenceMeter value={tierData!.confidence} className="tier-meter" />
                        <span className="tier-confidence-value">{tierData!.confidence}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="tier-empty">
                      <span className="tier-empty-text">No selections</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </StaggerItem>
          )
        })}
      </StaggerContainer>

      {/* Empty state overlay */}
      {!hasData && (
        <div className="betting-empty-overlay">
          <TrophyIllustration className="betting-empty-illustration" />
          <span className="betting-empty-text">Upload race data for recommendations</span>
        </div>
      )}

      {/* Advanced features - locked */}
      <div className="betting-advanced-section">
        <button className="betting-advanced-btn" disabled>
          <span className="material-icons">lock</span>
          <span>Advanced Settings</span>
          <span className="coming-soon-badge">Coming Soon</span>
        </button>
      </div>

      {/* Compare tracks - placeholder */}
      <div className="betting-feature-card locked">
        <div className="feature-card-header">
          <span className="material-icons">compare</span>
          <span>Compare Tracks</span>
        </div>
        <div className="feature-card-badge">Coming Soon</div>
      </div>

      {/* Historical performance - placeholder */}
      <div className="betting-feature-card locked">
        <div className="feature-card-header">
          <span className="material-icons">timeline</span>
          <span>Historical Performance</span>
        </div>
        <div className="feature-card-chart-placeholder">
          <div className="chart-bar" style={{ height: '30%' }} />
          <div className="chart-bar" style={{ height: '50%' }} />
          <div className="chart-bar" style={{ height: '70%' }} />
          <div className="chart-bar" style={{ height: '45%' }} />
          <div className="chart-bar" style={{ height: '60%' }} />
        </div>
        <div className="feature-card-badge">Coming Soon</div>
      </div>
    </motion.div>
  )
}

export default BettingPanel
