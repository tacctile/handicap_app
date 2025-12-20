/**
 * Bet Explanations Module
 *
 * Generate human-readable explanations for each bet recommendation.
 * Pulls from all scoring modules to build a narrative explaining
 * "Why this bet?"
 *
 * Examples:
 * - "#3 is lone speed in soft pace (25 pts from pace fit)"
 * - "Class drop from Allowance to $10K claimer (12 pts)"
 * - "Trainer wins 24% at this track (28 pts)"
 * - "200% overlay at current odds"
 * - "Expected value: +$2.40 per dollar wagered"
 *
 * @module recommendations/betExplanations
 */

import type { ClassifiedHorse } from '../betting/tierClassification'
import type { HorseScore, ScoreBreakdown } from '../scoring'

// ============================================================================
// TYPES
// ============================================================================

export interface ExplanationSection {
  /** Section title */
  title: string
  /** Explanation text */
  text: string
  /** Points contributed */
  points?: number
  /** Relevance to bet decision */
  relevance: 'high' | 'medium' | 'low'
  /** Icon for display */
  icon?: string
}

export interface BetExplanation {
  /** Main headline */
  headline: string
  /** Short summary (1-2 sentences) */
  summary: string
  /** Detailed explanation sections */
  sections: ExplanationSection[]
  /** Key factors list */
  keyFactors: string[]
  /** Risk assessment */
  riskAssessment: string
  /** Value assessment */
  valueAssessment: string
}

// ============================================================================
// SCORE THRESHOLD CONSTANTS
// ============================================================================

const THRESHOLDS = {
  pace: { strong: 30, good: 25, moderate: 20 },
  connections: { strong: 40, good: 30, moderate: 22 },
  speedClass: { strong: 40, good: 30, moderate: 20 },
  form: { strong: 25, good: 20, moderate: 15 },
  equipment: { significant: 15, notable: 10 },
  postPosition: { golden: 35, good: 25, moderate: 15 },
  breeding: { strong: 20, good: 15, moderate: 10 },
  overlay: { major: 50, good: 25, slight: 10 },
} as const

// ============================================================================
// CORE EXPLANATION GENERATORS
// ============================================================================

/**
 * Generate explanation for pace-related scoring
 */
function explainPace(breakdown: ScoreBreakdown): ExplanationSection | null {
  const pace = breakdown.pace
  if (pace.total < THRESHOLDS.pace.moderate) return null

  const relevance = pace.total >= THRESHOLDS.pace.strong ? 'high'
    : pace.total >= THRESHOLDS.pace.good ? 'medium' : 'low'

  let text = ''
  if (pace.reasoning.includes('lone')) {
    text = `Lone early speed in ${pace.paceFit} pace scenario`
  } else if (pace.reasoning.includes('closer') || pace.runningStyle.includes('Closer')) {
    text = `Late-running style benefits from expected ${pace.paceFit} pace`
  } else if (pace.reasoning.includes('stalker') || pace.runningStyle.includes('Stalker')) {
    text = `Stalking style positioned to inherit lead in ${pace.paceFit} pace`
  } else {
    text = `${pace.runningStyle} fits ${pace.paceFit} pace scenario`
  }

  return {
    title: 'Pace Advantage',
    text: `${text} (+${pace.total} pts)`,
    points: pace.total,
    relevance,
    icon: 'speed',
  }
}

/**
 * Generate explanation for connections (trainer/jockey)
 */
function explainConnections(breakdown: ScoreBreakdown): ExplanationSection | null {
  const conn = breakdown.connections
  if (conn.total < THRESHOLDS.connections.moderate) return null

  const relevance = conn.total >= THRESHOLDS.connections.strong ? 'high'
    : conn.total >= THRESHOLDS.connections.good ? 'medium' : 'low'

  const parts: string[] = []

  if (conn.trainer > 20) {
    parts.push(`Strong trainer (${conn.trainer} pts)`)
  }
  if (conn.jockey > 10) {
    parts.push(`Top jockey (${conn.jockey} pts)`)
  }
  if (conn.partnershipBonus > 0) {
    parts.push(`Winning partnership (+${conn.partnershipBonus} bonus)`)
  }

  if (parts.length === 0) {
    parts.push(conn.reasoning)
  }

  return {
    title: 'Connections',
    text: parts.join('; '),
    points: conn.total,
    relevance,
    icon: 'groups',
  }
}

/**
 * Generate explanation for speed and class
 */
function explainSpeedClass(breakdown: ScoreBreakdown): ExplanationSection | null {
  const sc = breakdown.speedClass
  if (sc.total < THRESHOLDS.speedClass.moderate) return null

  const relevance = sc.total >= THRESHOLDS.speedClass.strong ? 'high'
    : sc.total >= THRESHOLDS.speedClass.good ? 'medium' : 'low'

  const parts: string[] = []

  if (sc.bestFigure && sc.bestFigure > 0) {
    parts.push(`Best Beyer: ${sc.bestFigure}`)
  }

  if (sc.classMovement === 'dropping') {
    parts.push('Class drop advantage')
  } else if (sc.classMovement === 'lateral') {
    parts.push('Proven at class level')
  }

  if (parts.length === 0) {
    parts.push(sc.reasoning.split('|')[0].trim())
  }

  return {
    title: 'Speed & Class',
    text: `${parts.join('; ')} (+${sc.total} pts)`,
    points: sc.total,
    relevance,
    icon: 'bolt',
  }
}

/**
 * Generate explanation for form
 */
function explainForm(breakdown: ScoreBreakdown): ExplanationSection | null {
  const form = breakdown.form
  if (form.total < THRESHOLDS.form.moderate) return null

  const relevance = form.total >= THRESHOLDS.form.strong ? 'high'
    : form.total >= THRESHOLDS.form.good ? 'medium' : 'low'

  let text = ''
  if (form.formTrend === 'improving') {
    text = 'Improving form trend'
  } else if (form.formTrend === 'peaking') {
    text = 'Peak form condition'
  } else if (form.formTrend === 'consistent') {
    text = 'Consistently competitive'
  } else {
    text = form.reasoning
  }

  if (form.consistencyBonus > 0) {
    text += ` (+${form.consistencyBonus} consistency bonus)`
  }

  return {
    title: 'Current Form',
    text: `${text} (+${form.total} pts)`,
    points: form.total,
    relevance,
    icon: 'trending_up',
  }
}

/**
 * Generate explanation for equipment changes
 */
function explainEquipment(breakdown: ScoreBreakdown): ExplanationSection | null {
  const equip = breakdown.equipment
  if (!equip.hasChanges || equip.total < THRESHOLDS.equipment.notable) return null

  const relevance = equip.total >= THRESHOLDS.equipment.significant ? 'high' : 'medium'

  return {
    title: 'Equipment Change',
    text: `${equip.reasoning} (+${equip.total} pts)`,
    points: equip.total,
    relevance,
    icon: 'construction',
  }
}

/**
 * Generate explanation for post position
 */
function explainPostPosition(breakdown: ScoreBreakdown): ExplanationSection | null {
  const post = breakdown.postPosition
  if (post.total < THRESHOLDS.postPosition.moderate) return null

  const relevance = post.isGoldenPost ? 'high'
    : post.total >= THRESHOLDS.postPosition.good ? 'medium' : 'low'

  let text = post.isGoldenPost
    ? 'Golden post position for this distance'
    : post.reasoning

  if (post.trackBiasApplied) {
    text += ' (track bias applied)'
  }

  return {
    title: 'Post Position',
    text: `${text} (+${post.total} pts)`,
    points: post.total,
    relevance,
    icon: 'location_on',
  }
}

/**
 * Generate explanation for breeding (lightly raced horses)
 */
function explainBreeding(breakdown: ScoreBreakdown): ExplanationSection | null {
  const breeding = breakdown.breeding
  if (!breeding?.wasApplied || breeding.contribution < THRESHOLDS.breeding.moderate) return null

  const relevance = breeding.contribution >= THRESHOLDS.breeding.strong ? 'high'
    : breeding.contribution >= THRESHOLDS.breeding.good ? 'medium' : 'low'

  return {
    title: 'Breeding',
    text: `${breeding.summary} (+${Math.round(breeding.contribution)} pts)`,
    points: Math.round(breeding.contribution),
    relevance,
    icon: 'family_restroom',
  }
}

/**
 * Generate explanation for class analysis
 */
function explainClassAnalysis(breakdown: ScoreBreakdown): ExplanationSection | null {
  const classAnalysis = breakdown.classAnalysis
  if (!classAnalysis || classAnalysis.total < 10) return null

  const relevance = classAnalysis.isValuePlay ? 'high'
    : classAnalysis.hiddenDropsScore > 5 ? 'high' : 'medium'

  const parts: string[] = []

  if (classAnalysis.movement === 'dropping') {
    parts.push('Class dropper')
  }

  if (classAnalysis.hiddenDrops.length > 0) {
    const dropTypes = classAnalysis.hiddenDrops.map(d => d.type).join(', ')
    parts.push(`Hidden drops: ${dropTypes}`)
  }

  if (classAnalysis.provenAtLevelScore > 10) {
    parts.push('Proven at this level')
  }

  if (parts.length === 0) return null

  return {
    title: 'Class Edge',
    text: `${parts.join('; ')} (+${classAnalysis.total} pts)`,
    points: classAnalysis.total,
    relevance,
    icon: 'school',
  }
}

/**
 * Generate explanation for overlay/value
 */
function explainOverlay(horse: ClassifiedHorse): ExplanationSection | null {
  const overlay = horse.overlay
  if (overlay.overlayPercent < THRESHOLDS.overlay.slight) return null

  const relevance = overlay.overlayPercent >= THRESHOLDS.overlay.major ? 'high'
    : overlay.overlayPercent >= THRESHOLDS.overlay.good ? 'high' : 'medium'

  const parts: string[] = []

  parts.push(`${overlay.overlayPercent.toFixed(0)}% overlay`)

  if (overlay.isPositiveEV) {
    parts.push(`+EV: $${overlay.evPerDollar.toFixed(2)} per dollar wagered`)
  }

  parts.push(`Fair odds: ${overlay.fairOdds.toFixed(1)}-1 vs actual ${horse.oddsDisplay}`)

  return {
    title: 'Value Overlay',
    text: parts.join('; '),
    relevance,
    icon: 'paid',
  }
}

// ============================================================================
// MAIN EXPLANATION FUNCTIONS
// ============================================================================

/**
 * Generate bet explanation list for a bet
 * Returns array of explanation strings
 */
export function generateBetExplanation(
  horses: ClassifiedHorse[],
  betType: string
): string[] {
  const explanations: string[] = []

  // Get primary horse for single-horse bets
  const primaryHorse = horses[0]
  if (!primaryHorse) return ['Unable to analyze - no horse data']

  const breakdown = primaryHorse.score.breakdown

  // Add pace explanation
  if (breakdown.pace.total >= 20) {
    if (breakdown.pace.reasoning.includes('lone')) {
      explanations.push(`Lone ${breakdown.pace.runningStyle.toLowerCase()} in ${breakdown.pace.paceFit} pace (+${breakdown.pace.total} pace pts)`)
    } else {
      explanations.push(`${breakdown.pace.runningStyle} fits ${breakdown.pace.paceFit} pace (+${breakdown.pace.total} pts)`)
    }
  }

  // Add class drop explanation
  if (breakdown.classAnalysis?.movement === 'dropping') {
    explanations.push(`Class drop from ${breakdown.speedClass.classMovement} (+${breakdown.classAnalysis.classMovementScore} pts)`)
  }

  // Add trainer/jockey explanation
  if (breakdown.connections.total >= 30) {
    explanations.push(`Strong connections: ${breakdown.connections.reasoning} (+${breakdown.connections.total} pts)`)
  }

  // Add overlay explanation
  if (primaryHorse.overlay.overlayPercent >= 25) {
    explanations.push(`${primaryHorse.overlay.overlayPercent.toFixed(0)}% overlay at ${primaryHorse.oddsDisplay}`)
  }

  // Add EV explanation
  if (primaryHorse.overlay.isPositiveEV) {
    explanations.push(`Expected value: +$${primaryHorse.overlay.evPerDollar.toFixed(2)} per dollar wagered`)
  }

  // Add equipment change explanation
  if (breakdown.equipment.hasChanges && breakdown.equipment.total >= 10) {
    explanations.push(`Equipment change: ${breakdown.equipment.reasoning} (+${breakdown.equipment.total} pts)`)
  }

  // Add breeding explanation for lightly raced
  if (breakdown.breeding?.wasApplied) {
    explanations.push(`Breeding advantage: ${breakdown.breeding.summary}`)
  }

  // Add speed figure explanation
  if (breakdown.speedClass.bestFigure && breakdown.speedClass.bestFigure >= 80) {
    explanations.push(`Best Beyer ${breakdown.speedClass.bestFigure} competitive at this level`)
  }

  // Add special case explanation
  if (primaryHorse.isSpecialCase) {
    if (primaryHorse.specialCaseType === 'diamond_in_rough') {
      explanations.push('Diamond in Rough: moderate score with massive overlay')
    } else if (primaryHorse.specialCaseType === 'fool_gold') {
      explanations.push('Caution: High score but poor value (underlay)')
    }
  }

  // For multi-horse bets, add combination reasoning
  if (horses.length > 1 && betType.includes('exacta')) {
    const tiers = new Set(horses.map(h => h.tier))
    if (tiers.size > 1) {
      explanations.push('Combines chalk with value for upset coverage')
    }
  }

  if (horses.length >= 3 && betType.includes('trifecta')) {
    explanations.push('Box covers multiple finish permutations')
  }

  return explanations.length > 0 ? explanations : ['Based on overall handicapping score']
}

/**
 * Generate a short narrative summary for a bet
 */
export function generateBetNarrative(
  horses: ClassifiedHorse[],
  betType: string,
  overlayPercent: number
): string {
  const primaryHorse = horses[0]
  if (!primaryHorse) return 'No data available'

  const breakdown = primaryHorse.score.breakdown
  const parts: string[] = []

  // Start with horse identity
  parts.push(`#${primaryHorse.horse.programNumber} ${primaryHorse.horse.horseName}`)

  // Add key angle
  if (breakdown.pace.total >= 25) {
    parts.push(`fits ${breakdown.pace.paceFit} pace`)
  } else if (breakdown.classAnalysis?.isValuePlay) {
    parts.push('class edge')
  } else if (breakdown.connections.total >= 35) {
    parts.push('top connections')
  }

  // Add value assessment
  if (overlayPercent >= 50) {
    parts.push('at huge overlay')
  } else if (overlayPercent >= 25) {
    parts.push('with value')
  } else if (primaryHorse.overlay.isPositiveEV) {
    parts.push('+EV play')
  }

  // Add tier context
  if (primaryHorse.tier === 'tier1') {
    parts.push('(top contender)')
  } else if (primaryHorse.tier === 'tier3') {
    parts.push('(value bomb)')
  }

  return parts.join(' ')
}

/**
 * Generate full bet explanation object
 */
export function generateFullBetExplanation(
  horses: ClassifiedHorse[],
  betType: string
): BetExplanation {
  const primaryHorse = horses[0]
  if (!primaryHorse) {
    return {
      headline: 'Unable to analyze',
      summary: 'No horse data available for analysis.',
      sections: [],
      keyFactors: [],
      riskAssessment: 'Unknown',
      valueAssessment: 'Unknown',
    }
  }

  const breakdown = primaryHorse.score.breakdown
  const sections: ExplanationSection[] = []

  // Collect all relevant sections
  const paceSection = explainPace(breakdown)
  if (paceSection) sections.push(paceSection)

  const connectionsSection = explainConnections(breakdown)
  if (connectionsSection) sections.push(connectionsSection)

  const speedClassSection = explainSpeedClass(breakdown)
  if (speedClassSection) sections.push(speedClassSection)

  const formSection = explainForm(breakdown)
  if (formSection) sections.push(formSection)

  const equipmentSection = explainEquipment(breakdown)
  if (equipmentSection) sections.push(equipmentSection)

  const postSection = explainPostPosition(breakdown)
  if (postSection) sections.push(postSection)

  const breedingSection = explainBreeding(breakdown)
  if (breedingSection) sections.push(breedingSection)

  const classSection = explainClassAnalysis(breakdown)
  if (classSection) sections.push(classSection)

  const overlaySection = explainOverlay(primaryHorse)
  if (overlaySection) sections.push(overlaySection)

  // Sort by relevance
  sections.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.relevance] - order[b.relevance]
  })

  // Generate headline
  const topFactor = sections[0]?.title || 'Overall Score'
  const headline = `${primaryHorse.horse.horseName}: ${topFactor} advantage at ${primaryHorse.oddsDisplay}`

  // Generate summary
  const keyExplanations = sections.filter(s => s.relevance === 'high').slice(0, 2)
  const summary = keyExplanations.length > 0
    ? keyExplanations.map(s => s.text).join('. ')
    : `Scored ${primaryHorse.score.total} with ${primaryHorse.confidence}% confidence.`

  // Extract key factors
  const keyFactors = sections
    .filter(s => s.relevance !== 'low')
    .map(s => `${s.title}: ${s.text}`)

  // Risk assessment
  let riskAssessment = 'Moderate'
  if (primaryHorse.tier === 'tier1' && primaryHorse.confidence >= 80) {
    riskAssessment = 'Lower risk - top contender'
  } else if (primaryHorse.tier === 'tier3' || primaryHorse.odds >= 15) {
    riskAssessment = 'Higher risk - longshot play'
  } else if (primaryHorse.overlay.overlayPercent >= 50) {
    riskAssessment = 'Calculated risk - significant overlay'
  }

  // Value assessment
  let valueAssessment = 'Fair value'
  if (primaryHorse.overlay.overlayPercent >= 50) {
    valueAssessment = `Excellent value: ${primaryHorse.overlay.overlayPercent.toFixed(0)}% overlay`
  } else if (primaryHorse.overlay.isPositiveEV) {
    valueAssessment = `Good value: +$${primaryHorse.overlay.evPerDollar.toFixed(2)} EV`
  } else if (primaryHorse.overlay.overlayPercent < 0) {
    valueAssessment = `Underlay: ${Math.abs(primaryHorse.overlay.overlayPercent).toFixed(0)}% below fair odds`
  }

  return {
    headline,
    summary,
    sections,
    keyFactors,
    riskAssessment,
    valueAssessment,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get scoring sources that contributed to bet decision
 */
export function getScoringSources(horses: ClassifiedHorse[]): string[] {
  const sources = new Set<string>()

  for (const horse of horses) {
    const b = horse.score.breakdown

    if (b.pace.total >= 20) sources.add('Pace Analysis')
    if (b.connections.total >= 25) sources.add('Connections')
    if (b.speedClass.total >= 25) sources.add('Speed & Class')
    if (b.form.total >= 15) sources.add('Form')
    if (b.equipment.hasChanges) sources.add('Equipment')
    if (b.postPosition.total >= 20) sources.add('Post Position')
    if (b.breeding?.wasApplied) sources.add('Breeding')
    if (b.classAnalysis?.total && b.classAnalysis.total >= 10) sources.add('Class Analysis')
    if (horse.overlay.overlayPercent >= 25) sources.add('Overlay Analysis')
    if (horse.isSpecialCase) sources.add('Special Detection')
  }

  return Array.from(sources)
}

/**
 * Format explanation for display
 */
export function formatExplanationForDisplay(explanation: BetExplanation): string {
  const lines: string[] = []

  lines.push(`**${explanation.headline}**`)
  lines.push('')
  lines.push(explanation.summary)
  lines.push('')

  if (explanation.sections.length > 0) {
    lines.push('**Key Factors:**')
    for (const section of explanation.sections.filter(s => s.relevance !== 'low')) {
      lines.push(`- ${section.title}: ${section.text}`)
    }
    lines.push('')
  }

  lines.push(`Risk: ${explanation.riskAssessment}`)
  lines.push(`Value: ${explanation.valueAssessment}`)

  return lines.join('\n')
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ClassifiedHorse, HorseScore, ScoreBreakdown }
