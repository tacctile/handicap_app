import { useState, useMemo } from 'react'
import type { HorseEntry } from '../types/drf'
import type { HorseScore } from '../lib/scoring'
import {
  classifyHorses,
  generateBetRecommendations,
  formatCurrency,
  type TierBetRecommendations,
  type BetRecommendation,
  type BettingTier,
} from '../lib/betting'
import type { UseBankrollReturn, BankrollSettings } from '../hooks/useBankroll'

interface BettingRecommendationsProps {
  horses: Array<{ horse: HorseEntry; index: number; score: HorseScore }>
  raceNumber: number
  bankroll?: UseBankrollReturn
}

// Tier badge colors
const TIER_COLORS: Record<BettingTier, { bg: string; border: string; text: string }> = {
  tier1: { bg: 'rgba(25, 171, 181, 0.2)', border: 'rgba(25, 171, 181, 0.5)', text: '#19abb5' },
  tier2: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' },
  tier3: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#f59e0b' },
}

const TIER_ICONS: Record<BettingTier, string> = {
  tier1: 'workspace_premium',
  tier2: 'trending_up',
  tier3: 'bolt',
}

interface ExpansionPanelProps {
  tierRecs: TierBetRecommendations
  isExpanded: boolean
  onToggle: () => void
  raceNumber: number
}

function ExpansionPanel({ tierRecs, isExpanded, onToggle, raceNumber }: ExpansionPanelProps) {
  const tierColor = TIER_COLORS[tierRecs.tier]
  const tierIcon = TIER_ICONS[tierRecs.tier]

  return (
    <div className="betting-tier-panel">
      {/* Panel Header */}
      <button
        className="betting-tier-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="tier-header-left">
          <div
            className="tier-badge"
            style={{
              backgroundColor: tierColor.bg,
              borderColor: tierColor.border,
              color: tierColor.text,
            }}
          >
            <span className="material-icons tier-icon">{tierIcon}</span>
            <span className="tier-name">{tierRecs.tierName}</span>
          </div>
          <span className="tier-horse-count">
            {tierRecs.bets[0]?.horses.length || 0} horse{tierRecs.bets[0]?.horses.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="tier-header-right">
          <div className="tier-investment">
            <span className="investment-label">Total:</span>
            <span className="investment-amount">{formatCurrency(tierRecs.totalInvestment)}</span>
          </div>
          <span className={`material-icons expand-icon ${isExpanded ? 'expanded' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Panel Content */}
      {isExpanded && (
        <div className="betting-tier-content">
          {/* Tier Description */}
          <p className="tier-description">{tierRecs.description}</p>

          {/* Expected Hit Rate */}
          <div className="hit-rate-bar">
            <div className="hit-rate-item">
              <span className="hit-rate-label">Win</span>
              <div className="hit-rate-progress">
                <div
                  className="hit-rate-fill"
                  style={{ width: `${tierRecs.expectedHitRate.win}%`, backgroundColor: tierColor.text }}
                />
              </div>
              <span className="hit-rate-value">{tierRecs.expectedHitRate.win}%</span>
            </div>
            <div className="hit-rate-item">
              <span className="hit-rate-label">Place</span>
              <div className="hit-rate-progress">
                <div
                  className="hit-rate-fill"
                  style={{ width: `${tierRecs.expectedHitRate.place}%`, backgroundColor: tierColor.text }}
                />
              </div>
              <span className="hit-rate-value">{tierRecs.expectedHitRate.place}%</span>
            </div>
          </div>

          {/* Bet List */}
          <div className="bet-list">
            {tierRecs.bets.map((bet, index) => (
              <BetCard key={index} bet={bet} tierColor={tierColor} raceNumber={raceNumber} />
            ))}
          </div>

          {/* Potential Returns Summary */}
          <div className="return-summary">
            <span className="material-icons return-icon">payments</span>
            <span className="return-label">Potential Return:</span>
            <span className="return-range">
              {formatCurrency(tierRecs.potentialReturnRange.min)} - {formatCurrency(tierRecs.potentialReturnRange.max)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

interface BetCardProps {
  bet: BetRecommendation
  tierColor: { bg: string; border: string; text: string }
  raceNumber: number
}

function BetCard({ bet, tierColor, raceNumber }: BetCardProps) {
  const [showInstruction, setShowInstruction] = useState(false)

  // Generate window instruction with race number
  const windowInstruction = bet.windowInstruction.replace(
    /^"/,
    `"Race ${raceNumber}, `
  ).replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)

  return (
    <div className="bet-card">
      <div className="bet-card-header">
        <div className="bet-type-badge">
          <span className="material-icons bet-type-icon" style={{ color: tierColor.text }}>
            {bet.icon}
          </span>
          <span className="bet-type-name">{bet.typeName}</span>
        </div>
        <div className="bet-amount" style={{ color: tierColor.text }}>
          {formatCurrency(bet.totalCost)}
        </div>
      </div>

      <p className="bet-description">{bet.description}</p>

      <div className="bet-horses">
        {bet.horseNumbers.map((num, idx) => (
          <span key={idx} className="bet-horse-number">
            #{num}
          </span>
        ))}
      </div>

      <div className="bet-details">
        <div className="bet-confidence">
          <span className="material-icons confidence-icon">speed</span>
          <span>{bet.confidence}% conf</span>
        </div>
        <div className="bet-potential">
          <span className="material-icons potential-icon">trending_up</span>
          <span>
            {formatCurrency(bet.potentialReturn.min)}-{formatCurrency(bet.potentialReturn.max)}
          </span>
        </div>
      </div>

      {/* Window Instruction Toggle */}
      <button
        className="window-instruction-toggle"
        onClick={() => setShowInstruction(!showInstruction)}
      >
        <span className="material-icons">record_voice_over</span>
        <span>Window Instructions</span>
        <span className={`material-icons chevron ${showInstruction ? 'open' : ''}`}>
          chevron_right
        </span>
      </button>

      {showInstruction && (
        <div className="window-instruction-box">
          <p className="window-instruction-text">{windowInstruction}</p>
          <button
            className="copy-instruction-btn"
            onClick={() => navigator.clipboard.writeText(windowInstruction.replace(/^"|"$/g, ''))}
            title="Copy to clipboard"
          >
            <span className="material-icons">content_copy</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function BettingRecommendations({ horses, raceNumber, bankroll }: BettingRecommendationsProps) {
  const [expandedTiers, setExpandedTiers] = useState<Set<BettingTier>>(new Set(['tier1']))
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Get bankroll settings for bet sizing
  const bankrollSettings = bankroll?.settings
  const unitSize = bankroll?.getUnitSize() || 10

  // Classify horses and generate recommendations with bankroll-based sizing
  const recommendations = useMemo(() => {
    const tierGroups = classifyHorses(horses)
    const baseRecs = generateBetRecommendations(tierGroups)

    // If we have bankroll settings, scale the bet amounts
    if (bankrollSettings && unitSize) {
      return baseRecs.map(tierRec => {
        // Calculate tier multiplier based on risk tolerance
        const tierMultiplier = tierRec.tier === 'tier1' ? 1.5 :
                               tierRec.tier === 'tier2' ? 1.0 : 0.5

        // Calculate risk multiplier
        const riskMultiplier = bankrollSettings.riskTolerance === 'aggressive' ? 1.5 :
                               bankrollSettings.riskTolerance === 'conservative' ? 0.6 : 1.0

        const scaledBets = tierRec.bets.map(bet => {
          // Calculate confidence-based multiplier
          const confMultiplier = bet.confidence >= 80 ? 2.0 :
                                bet.confidence >= 70 ? 1.5 :
                                bet.confidence >= 60 ? 1.0 : 0.75

          // Calculate new amount based on unit size
          const newAmount = Math.round(unitSize * tierMultiplier * riskMultiplier * confMultiplier)
          const scaleFactor = newAmount / (bet.amount || 1)

          return {
            ...bet,
            amount: newAmount,
            totalCost: Math.round(bet.totalCost * scaleFactor),
            potentialReturn: {
              min: Math.round(bet.potentialReturn.min * scaleFactor),
              max: Math.round(bet.potentialReturn.max * scaleFactor),
            },
          }
        })

        const newTotalInvestment = scaledBets.reduce((sum, bet) => sum + bet.totalCost, 0)
        const newMinReturn = scaledBets.reduce((sum, bet) => sum + bet.potentialReturn.min, 0)
        const newMaxReturn = scaledBets.reduce((sum, bet) => sum + bet.potentialReturn.max, 0)

        return {
          ...tierRec,
          bets: scaledBets,
          totalInvestment: Math.round(newTotalInvestment * 100) / 100,
          potentialReturnRange: {
            min: Math.round(newMinReturn),
            max: Math.round(newMaxReturn),
          },
        }
      })
    }

    return baseRecs
  }, [horses, bankrollSettings, unitSize])

  // Check if we have any recommendations
  if (recommendations.length === 0 || recommendations.every(r => r.bets.length === 0)) {
    return null
  }

  const toggleTier = (tier: BettingTier) => {
    setExpandedTiers(prev => {
      const next = new Set(prev)
      if (next.has(tier)) {
        next.delete(tier)
      } else {
        next.add(tier)
      }
      return next
    })
  }

  const totalInvestment = recommendations.reduce((sum, r) => sum + r.totalInvestment, 0)

  return (
    <div className="betting-recommendations-container">
      {/* Section Header */}
      <button
        className="betting-section-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="section-header-left">
          <span className="material-icons section-icon">casino</span>
          <h3 className="section-title">Betting Recommendations</h3>
          <span className="section-badge">{recommendations.length} tiers</span>
        </div>
        <div className="section-header-right">
          <div className="total-investment-badge">
            <span>Total: </span>
            <span className="total-amount">{formatCurrency(totalInvestment)}</span>
          </div>
          <span className={`material-icons collapse-icon ${isCollapsed ? '' : 'expanded'}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Tier Panels - Responsive grid layout */}
      {!isCollapsed && (
        <>
          {/* Bankroll note */}
          {bankrollSettings && (
            <div className="bankroll-note">
              <span className="material-icons">info</span>
              <span className="bankroll-note-text">
                Based on your <strong>{bankroll?.formatCurrency(bankrollSettings.totalBankroll)}</strong> bankroll,{' '}
                <strong>{bankroll?.getRiskLabel()}</strong> risk
              </span>
            </div>
          )}

          <div className="betting-tiers-container betting-tiers-responsive">
            {recommendations.map(tierRecs => (
              <ExpansionPanel
                key={tierRecs.tier}
                tierRecs={tierRecs}
                isExpanded={expandedTiers.has(tierRecs.tier)}
                onToggle={() => toggleTier(tierRecs.tier)}
                raceNumber={raceNumber}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
