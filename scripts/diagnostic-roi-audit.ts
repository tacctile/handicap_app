/**
 * DIAGNOSTIC ROI AUDIT
 *
 * This script diagnoses the ROI calculation discrepancy between:
 * - Template-level ROI (+32% to +40% for trifecta)
 * - Bet-type level ROI (-65% to -100% for trifecta)
 *
 * The purpose is to find the exact bug causing these contradictory results.
 */

// ============================================================================
// IDENTIFIED BUG: PAYOUT ESTIMATION DISCREPANCY
// ============================================================================

/**
 * BUG LOCATION: scripts/validate-ai-architecture.ts
 *
 * PRIMARY ISSUE: Two different payout estimation systems produce wildly different results
 *
 * SYSTEM 1: Template-level ROI (shows +32% to +40%)
 * - Location: Lines 364-375 (PAYOUT_ESTIMATES constant)
 * - Location: Line 411-412 (getEstimatedPayout function)
 * - Uses FIXED payouts:
 *   - Template A trifecta: $100
 *   - Template B trifecta: $250
 *   - Template C trifecta: $200
 *
 * SYSTEM 2: Bet-type level ROI (shows -65% to -80%)
 * - Location: Lines 1203-1211 (estimateTrifectaPayout function)
 * - Uses ODDS-BASED payouts:
 *   - Formula: firstOdds * secondOdds * thirdOdds * 0.5 + 5
 *   - Typical result: $40-$100 depending on odds
 */

// ============================================================================
// MATHEMATICAL PROOF OF THE BUG
// ============================================================================

interface PayoutComparison {
  scenario: string;
  firstOdds: number;
  secondOdds: number;
  thirdOdds: number;
  oddsBasedPayout: number;
  templateBFixedPayout: number;
  discrepancyRatio: number;
}

function calculateOddsBasedPayout(
  firstOdds: number,
  secondOdds: number,
  thirdOdds: number
): number {
  // This is the formula from estimateTrifectaPayout (line 1210)
  return firstOdds * secondOdds * thirdOdds * 0.5 + 5;
}

const TEMPLATE_B_FIXED_PAYOUT = 250; // From PAYOUT_ESTIMATES

const testScenarios: PayoutComparison[] = [
  // Template B scenario: Favorite loses (rank 2, 3, 4 horses win)
  {
    scenario: 'Template B typical (longshot winner)',
    firstOdds: 5, // 5-1 (rank 2 or 3 horse wins)
    secondOdds: 2, // 2-1 (favorite comes 2nd)
    thirdOdds: 8, // 8-1 (rank 4 horse)
    oddsBasedPayout: 0,
    templateBFixedPayout: TEMPLATE_B_FIXED_PAYOUT,
    discrepancyRatio: 0,
  },
  {
    scenario: 'Template B with big upset',
    firstOdds: 8, // 8-1 winner
    secondOdds: 4, // 4-1 second
    thirdOdds: 3, // 3-1 (favorite) third
    oddsBasedPayout: 0,
    templateBFixedPayout: TEMPLATE_B_FIXED_PAYOUT,
    discrepancyRatio: 0,
  },
  {
    scenario: 'Template B moderate upset',
    firstOdds: 4, // 4-1 winner
    secondOdds: 2, // 2-1 second
    thirdOdds: 6, // 6-1 third
    oddsBasedPayout: 0,
    templateBFixedPayout: TEMPLATE_B_FIXED_PAYOUT,
    discrepancyRatio: 0,
  },
  {
    scenario: 'Box 4 typical (any order)',
    firstOdds: 3, // 3-1
    secondOdds: 4, // 4-1
    thirdOdds: 5, // 5-1
    oddsBasedPayout: 0,
    templateBFixedPayout: TEMPLATE_B_FIXED_PAYOUT,
    discrepancyRatio: 0,
  },
];

// Calculate odds-based payouts and discrepancy ratios
testScenarios.forEach((s) => {
  s.oddsBasedPayout = calculateOddsBasedPayout(s.firstOdds, s.secondOdds, s.thirdOdds);
  s.discrepancyRatio = s.templateBFixedPayout / s.oddsBasedPayout;
});

console.log('='.repeat(80));
console.log('DIAGNOSTIC ROI AUDIT - PAYOUT ESTIMATION DISCREPANCY');
console.log('='.repeat(80));
console.log('\n## PAYOUT COMPARISON\n');
console.log(
  'Scenario                          | Odds-Based | Fixed ($250) | Ratio'
);
console.log('-'.repeat(80));
testScenarios.forEach((s) => {
  const name = s.scenario.padEnd(33);
  const odds = `$${s.oddsBasedPayout.toFixed(2).padStart(6)}`;
  const fixed = `$${s.templateBFixedPayout.toFixed(2).padStart(6)}`;
  const ratio = `${s.discrepancyRatio.toFixed(1)}x`;
  console.log(`${name} | ${odds}     | ${fixed}       | ${ratio}`);
});

// ============================================================================
// IMPACT ANALYSIS
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('IMPACT ANALYSIS');
console.log('='.repeat(80));

interface ROICalculation {
  system: string;
  races: number;
  costPerRace: number;
  totalCost: number;
  hitCount: number;
  payoutPerHit: number;
  totalPayout: number;
  roi: number;
}

// Hypothetical Template B stats (based on +32.3% ROI with 63 races)
const templateBRaces = 63;
const templateBCostPerRace = 18; // 18 combos @ $1
const templateBTotalCost = templateBRaces * templateBCostPerRace; // $1,134

// Working backwards from +32.3% ROI:
// ROI = (Payout - Cost) / Cost
// 0.323 = (Payout - 1134) / 1134
// Payout = 1134 * 1.323 = $1,500
const templateBTotalPayout = templateBTotalCost * 1.323;
const templateBHits = Math.round(templateBTotalPayout / TEMPLATE_B_FIXED_PAYOUT); // ~6 hits

// Now calculate what ROI would be with odds-based payouts
const avgOddsBasedPayout =
  testScenarios.reduce((sum, s) => sum + s.oddsBasedPayout, 0) / testScenarios.length;
const correctedTotalPayout = templateBHits * avgOddsBasedPayout;
const correctedROI = ((correctedTotalPayout - templateBTotalCost) / templateBTotalCost) * 100;

console.log('\n## Template B Trifecta ROI Recalculation\n');
console.log(`Races: ${templateBRaces}`);
console.log(`Cost per race: $${templateBCostPerRace} (18 combos × $1)`);
console.log(`Total cost: $${templateBTotalCost}`);
console.log(`Estimated hits: ~${templateBHits}`);
console.log('');
console.log('WITH FIXED $250 PAYOUT:');
console.log(`  Total payout: $${templateBTotalPayout.toFixed(0)}`);
console.log(`  ROI: +32.3%`);
console.log('');
console.log(`WITH ODDS-BASED PAYOUT (avg $${avgOddsBasedPayout.toFixed(2)}):`);
console.log(`  Total payout: $${correctedTotalPayout.toFixed(0)}`);
console.log(`  ROI: ${correctedROI >= 0 ? '+' : ''}${correctedROI.toFixed(1)}%`);

// ============================================================================
// BOX 4 COMPARISON
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('BOX 4 COMPARISON');
console.log('='.repeat(80));

// Box 4 for all non-PASS races (69 races based on user data)
const box4Races = 69;
const box4CostPerRace = 24; // 24 combos @ $1 (P(4,3) = 4×3×2)
const box4TotalCost = box4Races * box4CostPerRace; // $1,656

// Box 4 has ~15-20% hit rate (covers more scenarios than Template B)
const box4HitRate = 0.15; // Conservative estimate
const box4Hits = Math.round(box4Races * box4HitRate);

// Box 4 uses odds-based payouts
const box4TotalPayout = box4Hits * avgOddsBasedPayout;
const box4ROI = ((box4TotalPayout - box4TotalCost) / box4TotalCost) * 100;

console.log('\n## Box 4 Trifecta ROI (Algorithm+AI)\n');
console.log(`Races: ${box4Races}`);
console.log(`Cost per race: $${box4CostPerRace} (24 combos × $1)`);
console.log(`Total cost: $${box4TotalCost}`);
console.log(`Hit rate: ~${(box4HitRate * 100).toFixed(0)}%`);
console.log(`Estimated hits: ~${box4Hits}`);
console.log(`Avg payout per hit: $${avgOddsBasedPayout.toFixed(2)}`);
console.log(`Total payout: $${box4TotalPayout.toFixed(0)}`);
console.log(`ROI: ${box4ROI >= 0 ? '+' : ''}${box4ROI.toFixed(1)}%`);

// ============================================================================
// ROOT CAUSE SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('ROOT CAUSE SUMMARY');
console.log('='.repeat(80));
console.log(`
## THE BUG

Location: scripts/validate-ai-architecture.ts

The validation script uses TWO INCOMPATIBLE payout estimation systems:

### System 1: Template-Level ROI (Lines 364-375, 411-412)
- Uses FIXED payouts defined in PAYOUT_ESTIMATES constant
- Template B trifecta: $250 per hit
- This produces the +32% to +40% ROI figures

### System 2: Bet-Type Level ROI (Lines 1203-1211)
- Uses DYNAMIC odds-based payouts via estimateTrifectaPayout()
- Formula: firstOdds * secondOdds * thirdOdds * 0.5 + 5
- Typical payout: $40-$100 per hit
- This produces the -65% to -80% ROI figures

### WHY THEY CONTRADICT

The fixed $250 payout for Template B is approximately ${(TEMPLATE_B_FIXED_PAYOUT / avgOddsBasedPayout).toFixed(1)}x HIGHER
than the odds-based calculation would produce.

When you use an inflated payout estimate:
- 6 hits × $250 = $1,500 → +32% ROI ✓ (reported)

When you use realistic odds-based payout:
- 6 hits × $${avgOddsBasedPayout.toFixed(0)} = $${(6 * avgOddsBasedPayout).toFixed(0)} → ${correctedROI.toFixed(0)}% ROI ← (reality)

## THE FIX

Option 1: Use odds-based payouts consistently everywhere
- Replace getEstimatedPayout() calls with estimateTrifectaPayout()
- This will make template ROI match bet-type ROI

Option 2: Calibrate PAYOUT_ESTIMATES to realistic values
- Analyze historical trifecta payouts by template
- Update the constants to match actual data

## RECOMMENDED ACTION

Do NOT trust the +32% to +40% trifecta ROI figures.
The bet-type level ROI (-65% to -80%) is likely more accurate.

Before betting real money:
1. Validate payouts against actual historical data
2. Use a consistent payout calculation method
3. Re-run validation with corrected payouts
`);

// ============================================================================
// DETAILED COST BASIS COMPARISON
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('DETAILED COST BASIS COMPARISON');
console.log('='.repeat(80));
console.log(`
## COST CALCULATIONS (Both systems use correct costs)

### Template B Cost (calculateTicketCost function, line 392-396)
- 18 trifecta combos @ $1 = $18 per race
- Structure: 1st from [2,3,4], 2nd from [1,2,3,4], 3rd from [1,2,3,4]
- Combinations: 3 × 3 × 2 = 18 ✓

### Box 4 Cost (calculateTrifectaBoxCost function, line 1135-1137)
- Formula: n × (n-1) × (n-2) × $1
- Box 4: 4 × 3 × 2 = 24 combos = $24 per race ✓
- Box 5: 5 × 4 × 3 = 60 combos = $60 per race ✓
- Box 3: 3 × 2 × 1 = 6 combos = $6 per race ✓

The cost calculations are CORRECT. The bug is in PAYOUT estimation only.

## HIT CRITERIA DIFFERENCES

### Template B Hit Check (checkTemplateTrifectaHit, lines 891-897)
- 1st place MUST be rank 2, 3, or 4 (favorite CANNOT win)
- 2nd and 3rd must be from top 4
- This is a "fade the favorite" strategy

### Box 4 Hit Check (checkTrifectaBoxN function)
- ANY permutation of top 4 horses in 1-2-3 positions
- Includes scenarios where favorite wins
- Broader coverage than Template B

Template B hits are a SUBSET of Box 4 hits. Box 4 wins every time Template B
wins, plus additional scenarios where the favorite wins.
`);

// ============================================================================
// DIAGNOSTIC INTERFACE FOR EXPORT
// ============================================================================

export interface DiagnosticBet {
  raceId: string;
  template: 'A' | 'B' | 'C' | 'PASS';
  betType: string;
  combinations: number;
  baseUnit: number;
  totalStake: number;
  payoutFixed: number; // Template payout estimate
  payoutOddsBased: number; // Odds-based payout
  netProfitFixed: number;
  netProfitOddsBased: number;
  hit: boolean;
}

console.log('\n' + '='.repeat(80));
console.log('DIAGNOSTIC COMPLETE');
console.log('='.repeat(80));
console.log(`
Run this script with: npx ts-node scripts/diagnostic-roi-audit.ts

For full verification, modify validate-ai-architecture.ts to:
1. Log actual payout calculations for each hit
2. Compare template vs odds-based payouts
3. Export detailed bet-by-bet data for manual verification
`);
