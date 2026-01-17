#!/usr/bin/env npx ts-node
/**
 * Validation Results Analyzer
 *
 * Standalone script to analyze AI vs Algorithm validation results.
 * Loads results from the JSON file and outputs disagreement patterns.
 *
 * Usage:
 *   npx ts-node src/__tests__/validation/analyzeResults.ts
 *   npx ts-node src/__tests__/validation/analyzeResults.ts --json
 *   npx ts-node src/__tests__/validation/analyzeResults.ts --disagreements-only
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  type DetailedRaceResult,
  type ValidationResultsFile,
  type PatternGroup,
  type AnalysisByGroup,
  getDisagreements,
  categorizeDistance,
  categorizeFieldSize,
  categorizeScoreDiff,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESULTS_PATH = path.join(__dirname, 'results/ai_comparison_results.json');

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Group races by a specific field and calculate win rates
 */
function groupBy<T extends string | number>(
  races: DetailedRaceResult[],
  keyFn: (r: DetailedRaceResult) => T,
  labelFn?: (key: T) => string
): PatternGroup[] {
  const groups = new Map<T, DetailedRaceResult[]>();

  for (const race of races) {
    const key = keyFn(race);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(race);
  }

  return Array.from(groups.entries())
    .map(([key, groupRaces]) => {
      const aiWins = groupRaces.filter((r) => r.winner.wasAiPick).length;
      return {
        label: labelFn ? labelFn(key) : String(key),
        count: groupRaces.length,
        races: groupRaces,
        winRate: groupRaces.length > 0 ? Math.round((aiWins / groupRaces.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate full analysis by various groupings
 */
function analyzeByGroups(races: DetailedRaceResult[]): AnalysisByGroup {
  return {
    byTrack: groupBy(races, (r) => r.trackCode),
    bySurface: groupBy(races, (r) => r.surface),
    byDistance: groupBy(races, (r) => categorizeDistance(r.distanceFurlongs)),
    byConfidence: groupBy(races, (r) => r.aiConfidence || 'N/A'),
    byScoreDifferential: groupBy(races, (r) => categorizeScoreDiff(r.algorithmPick.scoreMargin)),
    byFieldSize: groupBy(races, (r) => categorizeFieldSize(r.fieldSize)),
    byOverrideType: groupBy(races, (r) => r.aiPick.overrideType),
  };
}

/**
 * Print a pattern group table
 */
function printPatternTable(title: string, groups: PatternGroup[]): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`${'Group'.padEnd(20)} ${'Count'.padStart(8)} ${'AI Win%'.padStart(10)}`);
  console.log(`${'-'.repeat(20)} ${'-'.repeat(8)} ${'-'.repeat(10)}`);

  for (const group of groups) {
    console.log(
      `${group.label.padEnd(20)} ${String(group.count).padStart(8)} ${String(group.winRate + '%').padStart(10)}`
    );
  }
}

/**
 * Print detailed disagreement race
 */
function printDisagreementRace(race: DetailedRaceResult, index: number): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Race ${index + 1}: ${race.trackCode} R${race.raceNumber} - ${race.date}`);
  console.log(`${'─'.repeat(60)}`);

  console.log(`Surface: ${race.surface} | Distance: ${race.distance} | Field: ${race.fieldSize}`);

  console.log(
    `\nAlgorithm Pick: #${race.algorithmPick.postPosition} ${race.algorithmPick.horseName}`
  );
  console.log(
    `  Score: ${race.algorithmPick.score} | Tier: ${race.algorithmPick.tier} | Margin: +${race.algorithmPick.scoreMargin}`
  );
  console.log(`  Top categories: ${race.algorithmPick.topCategories.join(', ')}`);

  console.log(
    `\nAI Pick: ${race.aiPick.postPosition ? `#${race.aiPick.postPosition} ${race.aiPick.horseName}` : 'PASS'}`
  );
  console.log(`  Override type: ${race.aiPick.overrideType}`);
  if (race.aiPick.algorithmScore) {
    console.log(
      `  Algorithm score: ${race.aiPick.algorithmScore} (rank #${race.aiPick.algorithmRank})`
    );
  }
  console.log(`  Reasoning: ${race.aiPick.reasoning || 'N/A'}`);
  if (race.aiPick.topPickOneLiner) {
    console.log(`  One-liner: ${race.aiPick.topPickOneLiner}`);
  }

  console.log(`\nActual Winner: #${race.winner.postPosition} ${race.winner.horseName}`);
  console.log(
    `  Odds: ${race.winner.odds} | Algorithm score: ${race.winner.algorithmScore} (rank #${race.winner.algorithmRank})`
  );
  console.log(`  Was algorithm pick: ${race.winner.wasAlgorithmPick ? 'YES' : 'NO'}`);
  console.log(`  Was AI pick: ${race.winner.wasAiPick ? 'YES' : 'NO'}`);

  console.log(`\nBot Signals:`);
  console.log(`  Pace: ${race.botSignals.paceProjection || 'N/A'}`);
  console.log(`  Lone speed: ${race.botSignals.loneSpeedException ? 'YES' : 'NO'}`);
  console.log(`  Speed duel: ${race.botSignals.speedDuelLikely ? 'YES' : 'NO'}`);
  console.log(`  Vulnerable favorite: ${race.botSignals.vulnerableFavorite ? 'YES' : 'NO'}`);
  console.log(`  Field type: ${race.botSignals.fieldType || 'N/A'}`);

  console.log(`\nOutcome: ${race.outcome}`);
}

/**
 * Analyze patterns in disagreement losses
 */
function analyzeDisagreementPatterns(
  aiLosses: DetailedRaceResult[],
  algoLosses: DetailedRaceResult[]
): void {
  console.log('\n' + '═'.repeat(70));
  console.log('                    DISAGREEMENT PATTERN ANALYSIS');
  console.log('═'.repeat(70));

  // AI Losses Analysis
  console.log('\n## When AI Overrode and LOST (Algorithm was right)');
  console.log(`Total: ${aiLosses.length} races\n`);

  if (aiLosses.length > 0) {
    // Score differential pattern
    const avgScoreDiff =
      aiLosses.reduce((sum, r) => {
        const aiScore = r.aiPick.algorithmScore || 0;
        const algoScore = r.algorithmPick.score;
        return sum + (algoScore - aiScore);
      }, 0) / aiLosses.length;
    console.log(`Average score difference (algo - AI pick): ${avgScoreDiff.toFixed(1)}`);

    // Tier analysis
    const tierDrops = aiLosses.filter((r) => r.aiPick.tier > r.algorithmPick.tier).length;
    console.log(`AI picked lower tier than algorithm: ${tierDrops}/${aiLosses.length}`);

    // Confidence analysis
    const lowConfOverrides = aiLosses.filter((r) => r.algorithmPick.confidence === 'HIGH').length;
    console.log(`Overrode HIGH confidence algorithm picks: ${lowConfOverrides}/${aiLosses.length}`);

    // Bot signals that led to bad overrides
    const tripTroubleOverrides = aiLosses.filter((r) => r.botSignals.tripTrouble).length;
    const vulnFavOverrides = aiLosses.filter((r) => r.botSignals.vulnerableFavorite).length;
    console.log(`Trip trouble signal present: ${tripTroubleOverrides}/${aiLosses.length}`);
    console.log(`Vulnerable favorite signal present: ${vulnFavOverrides}/${aiLosses.length}`);

    // Surface/distance patterns
    const dirtLosses = aiLosses.filter((r) => r.surface === 'dirt').length;
    const sprintLosses = aiLosses.filter(
      (r) => categorizeDistance(r.distanceFurlongs) === 'sprint'
    ).length;
    console.log(`On dirt: ${dirtLosses}/${aiLosses.length}`);
    console.log(`At sprint distance: ${sprintLosses}/${aiLosses.length}`);
  }

  // Algorithm Losses Analysis (AI was right)
  console.log('\n## When AI Overrode and WON (Algorithm was wrong)');
  console.log(`Total: ${algoLosses.length} races\n`);

  if (algoLosses.length > 0) {
    // What signals did AI catch?
    const tripTroubleWins = algoLosses.filter((r) => r.botSignals.tripTrouble).length;
    const vulnFavWins = algoLosses.filter((r) => r.botSignals.vulnerableFavorite).length;
    const loneSpeedException = algoLosses.filter((r) => r.botSignals.loneSpeedException).length;
    const speedDuelWins = algoLosses.filter((r) => r.botSignals.speedDuelLikely).length;

    console.log(`Trip trouble signal present: ${tripTroubleWins}/${algoLosses.length}`);
    console.log(`Vulnerable favorite signal present: ${vulnFavWins}/${algoLosses.length}`);
    console.log(`Lone speed exception: ${loneSpeedException}/${algoLosses.length}`);
    console.log(`Speed duel signal: ${speedDuelWins}/${algoLosses.length}`);

    // Algorithm confidence when AI was right to override
    const lowConfAlgo = algoLosses.filter((r) => r.algorithmPick.confidence === 'LOW').length;
    const medConfAlgo = algoLosses.filter((r) => r.algorithmPick.confidence === 'MEDIUM').length;
    console.log(`Algorithm was LOW confidence: ${lowConfAlgo}/${algoLosses.length}`);
    console.log(`Algorithm was MEDIUM confidence: ${medConfAlgo}/${algoLosses.length}`);

    // Tight margins
    const tightMargins = algoLosses.filter((r) => r.algorithmPick.scoreMargin < 10).length;
    console.log(`Tight score margin (<10): ${tightMargins}/${algoLosses.length}`);
  }
}

/**
 * Generate recommendations based on patterns
 */
function generateRecommendations(
  aiLosses: DetailedRaceResult[],
  algoLosses: DetailedRaceResult[]
): void {
  console.log('\n' + '═'.repeat(70));
  console.log('                    RECOMMENDATIONS');
  console.log('═'.repeat(70));

  const recommendations: string[] = [];

  // Analyze AI loss patterns
  if (aiLosses.length > 0) {
    const highConfOverrides = aiLosses.filter((r) => r.algorithmPick.confidence === 'HIGH').length;
    if (highConfOverrides / aiLosses.length > 0.5) {
      recommendations.push(
        'CAUTION: AI is overriding HIGH confidence algorithm picks and losing. Consider adding guardrail to require stronger signals before overriding high confidence picks.'
      );
    }

    const largeTierDrops = aiLosses.filter(
      (r) => (r.aiPick.tier || 0) >= (r.algorithmPick.tier || 0) + 2
    ).length;
    if (largeTierDrops > 0) {
      recommendations.push(
        `WARNING: AI picked horses 2+ tiers below algorithm's pick in ${largeTierDrops} losing races. Consider limiting tier drop magnitude.`
      );
    }

    const vulnFavFalsePositives = aiLosses.filter((r) => r.botSignals.vulnerableFavorite).length;
    if (vulnFavFalsePositives / aiLosses.length > 0.3) {
      recommendations.push(
        'ISSUE: Vulnerable favorite signal is generating false positives. Consider tightening criteria or requiring additional confirmation.'
      );
    }
  }

  // Analyze successful override patterns
  if (algoLosses.length > 0) {
    const lowConfWins = algoLosses.filter(
      (r) => r.algorithmPick.confidence === 'LOW' || r.algorithmPick.confidence === 'MEDIUM'
    ).length;
    if (lowConfWins / algoLosses.length > 0.6) {
      recommendations.push(
        'POSITIVE: AI successfully identifies opportunities when algorithm confidence is low. Continue trusting AI on low confidence races.'
      );
    }

    const tightMarginWins = algoLosses.filter((r) => r.algorithmPick.scoreMargin < 10).length;
    if (tightMarginWins / algoLosses.length > 0.5) {
      recommendations.push(
        'POSITIVE: AI adds value in tight races (score margin <10). Consider giving AI more weight in close calls.'
      );
    }
  }

  // Net assessment
  if (algoLosses.length > aiLosses.length) {
    recommendations.push(
      `NET POSITIVE: AI disagreements are profitable (${algoLosses.length} wins vs ${aiLosses.length} losses). Current override strategy is working.`
    );
  } else if (aiLosses.length > algoLosses.length) {
    recommendations.push(
      `NET NEGATIVE: AI disagreements are unprofitable (${aiLosses.length} losses vs ${algoLosses.length} wins). Consider making AI more conservative.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Insufficient data for specific recommendations. Run more validation races.'
    );
  }

  for (let i = 0; i < recommendations.length; i++) {
    console.log(`\n${i + 1}. ${recommendations[i]}`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const disagreementsOnly = args.includes('--disagreements-only');

  // Check if results file exists
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error(`\nError: Results file not found at ${RESULTS_PATH}`);
    console.error('Run the validation test first:');
    console.error('  npm test -- --run src/__tests__/validation/aiVsAlgorithm.test.ts\n');
    process.exit(1);
  }

  // Load results
  const rawData = fs.readFileSync(RESULTS_PATH, 'utf-8');
  const results: ValidationResultsFile = JSON.parse(rawData);

  console.log('\n' + '═'.repeat(70));
  console.log('              AI vs ALGORITHM VALIDATION ANALYSIS');
  console.log('═'.repeat(70));
  console.log(`Generated: ${results.generatedAt}`);
  console.log(`Version: ${results.version}`);
  console.log(`Total races: ${results.detailedResults.length}`);

  // Get disagreements
  const disagreements = results.disagreements || getDisagreements(results.detailedResults);

  console.log(`\nDisagreement Summary:`);
  console.log(`  AI disagreed and WON: ${disagreements.aiDisagreedAndWon.length}`);
  console.log(`  AI disagreed and LOST: ${disagreements.aiDisagreedAndLost.length}`);

  if (jsonOutput) {
    // Output as JSON for programmatic use
    console.log(JSON.stringify({ disagreements }, null, 2));
    return;
  }

  if (!disagreementsOnly) {
    // Full analysis by groups
    const analysis = analyzeByGroups(results.detailedResults);

    printPatternTable('BY TRACK', analysis.byTrack);
    printPatternTable('BY SURFACE', analysis.bySurface);
    printPatternTable('BY DISTANCE', analysis.byDistance);
    printPatternTable('BY AI CONFIDENCE', analysis.byConfidence);
    printPatternTable('BY SCORE MARGIN', analysis.byScoreDifferential);
    printPatternTable('BY FIELD SIZE', analysis.byFieldSize);
    printPatternTable('BY OVERRIDE TYPE', analysis.byOverrideType);
  }

  // Print disagreement details
  if (disagreements.aiDisagreedAndLost.length > 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('           AI DISAGREED AND LOST (Algorithm was right)');
    console.log('═'.repeat(70));

    for (let i = 0; i < disagreements.aiDisagreedAndLost.length; i++) {
      printDisagreementRace(disagreements.aiDisagreedAndLost[i], i);
    }
  }

  if (disagreements.aiDisagreedAndWon.length > 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('           AI DISAGREED AND WON (AI was right)');
    console.log('═'.repeat(70));

    for (let i = 0; i < disagreements.aiDisagreedAndWon.length; i++) {
      printDisagreementRace(disagreements.aiDisagreedAndWon[i], i);
    }
  }

  // Pattern analysis
  analyzeDisagreementPatterns(disagreements.aiDisagreedAndLost, disagreements.aiDisagreedAndWon);

  // Generate recommendations
  generateRecommendations(disagreements.aiDisagreedAndLost, disagreements.aiDisagreedAndWon);

  console.log('\n' + '═'.repeat(70) + '\n');
}

// Run if executed directly
main();
