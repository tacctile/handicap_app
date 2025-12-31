/**
 * Forensic Diagnosis Script - Analyze Bad Beat Race
 *
 * This script analyzes a specific race where our top pick (Tier 1, 180+ pts)
 * lost to identify which scoring category gave undeserved points.
 *
 * Target: GPX Race 2, 12/24 - Magic Red (263 pts, 4th place) vs Araucano (winner)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores, type ScoredHorse } from '../src/lib/scoring';
import type { TrackCondition } from '../src/hooks/useRaceState';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION - HARDCODED BAD BEAT RACE
// ============================================================================

const RACE_CONFIG = {
  drfFile: 'GPX1224.DRF',
  raceNumber: 2,
  ourLoserPost: 4,      // Magic Red (our top pick, finished 4th)
  winnerPost: 8,        // Araucano (actual winner)
  ourLoserName: 'MAGIC RED',
  winnerName: 'ARAUCANO',
};

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

async function diagnoseRace() {
  console.log('\n' + '═'.repeat(80));
  console.log('          FORENSIC DIAGNOSIS: BAD BEAT ANALYSIS');
  console.log('═'.repeat(80));
  console.log(`\nRace: ${RACE_CONFIG.drfFile} - Race ${RACE_CONFIG.raceNumber}`);
  console.log(`Our Pick: #${RACE_CONFIG.ourLoserPost} ${RACE_CONFIG.ourLoserName} (LOST - 4th place)`);
  console.log(`Winner:   #${RACE_CONFIG.winnerPost} ${RACE_CONFIG.winnerName}`);
  console.log('═'.repeat(80) + '\n');

  // Load and parse DRF file
  const drfPath = path.join(__dirname, '../src/data', RACE_CONFIG.drfFile);
  const drfContent = fs.readFileSync(drfPath, 'utf-8');
  const parseResult = parseDRFFile(drfContent);

  // Find the target race
  const targetRace = parseResult.races.find(r => r.header.raceNumber === RACE_CONFIG.raceNumber);
  if (!targetRace) {
    console.error(`Race ${RACE_CONFIG.raceNumber} not found in ${RACE_CONFIG.drfFile}`);
    process.exit(1);
  }

  // Calculate scores for all horses
  const trackCondition: TrackCondition = {
    surface: targetRace.header.surface,
    condition: targetRace.header.condition || 'fast',
    variant: 0,
  };

  const scratches = new Set(['dominican thunder']); // Race 2 scratch

  const scoredHorses = calculateRaceScores(
    targetRace.horses,
    targetRace.header,
    (idx, defaultOdds) => targetRace.horses[idx]?.morningLineOdds || defaultOdds,
    (idx) => {
      const horse = targetRace.horses[idx];
      return horse ? scratches.has(horse.horseName.toLowerCase()) : false;
    },
    trackCondition
  );

  // Find our two horses
  const ourLoser = scoredHorses.find(h => h.horse.programNumber === RACE_CONFIG.ourLoserPost);
  const winner = scoredHorses.find(h => h.horse.programNumber === RACE_CONFIG.winnerPost);

  if (!ourLoser || !winner) {
    console.error('Could not find both horses in the race');
    process.exit(1);
  }

  // Sort all horses by score to see rankings
  const ranked = [...scoredHorses]
    .filter(h => !h.score.isScratched)
    .sort((a, b) => b.score.baseScore - a.score.baseScore);

  console.log('RACE OVERVIEW:');
  console.log('─'.repeat(80));
  console.log(`Race Type: ${targetRace.header.raceType} | Distance: ${targetRace.header.distance}F | Surface: ${targetRace.header.surface}`);
  console.log(`Purse: $${targetRace.header.purse?.toLocaleString() || 'N/A'} | Conditions: ${targetRace.header.conditions || 'N/A'}`);
  console.log('\n');

  // Print ranking table
  console.log('ALGORITHM RANKINGS (by Base Score):');
  console.log('─'.repeat(80));
  console.log('Rank | Post | Horse                     | Base Score | Actual Finish');
  console.log('─'.repeat(80));
  ranked.forEach((h, i) => {
    const isOurPick = h.horse.programNumber === RACE_CONFIG.ourLoserPost;
    const isWinner = h.horse.programNumber === RACE_CONFIG.winnerPost;
    const marker = isOurPick ? ' ← OUR PICK (4th)' : isWinner ? ' ← WINNER' : '';
    const actualFinish = isOurPick ? '4th' : isWinner ? '1st' : '';
    console.log(
      `  ${(i + 1).toString().padStart(2)}  |  #${h.horse.programNumber.toString().padStart(2)} | ${h.horse.horseName.padEnd(25)} |    ${h.score.baseScore.toString().padStart(3)}     | ${actualFinish.padEnd(4)}${marker}`
    );
  });

  // Side-by-side comparison
  console.log('\n\n' + '█'.repeat(80));
  console.log('            SIDE-BY-SIDE SCORING COMPARISON: WINNER vs OUR LOSER');
  console.log('█'.repeat(80));

  const loserBreakdown = ourLoser.score.breakdown;
  const winnerBreakdown = winner.score.breakdown;

  // Create comparison table
  const categories = [
    {
      name: 'Speed Score',
      loser: loserBreakdown.speedClass.speedScore,
      winner: winnerBreakdown.speedClass.speedScore,
      max: 105
    },
    {
      name: 'Class Score',
      loser: loserBreakdown.speedClass.classScore,
      winner: winnerBreakdown.speedClass.classScore,
      max: 35
    },
    {
      name: 'Form',
      loser: loserBreakdown.form.total,
      winner: winnerBreakdown.form.total,
      max: 42
    },
    {
      name: 'Pace',
      loser: loserBreakdown.pace.total,
      winner: winnerBreakdown.pace.total,
      max: 35
    },
    {
      name: 'Connections',
      loser: loserBreakdown.connections.total,
      winner: winnerBreakdown.connections.total,
      max: 23
    },
    {
      name: 'Post Position',
      loser: loserBreakdown.postPosition.total,
      winner: winnerBreakdown.postPosition.total,
      max: 12
    },
    {
      name: 'Odds Factor',
      loser: loserBreakdown.odds.total,
      winner: winnerBreakdown.odds.total,
      max: 12
    },
    {
      name: 'Distance/Surface',
      loser: loserBreakdown.distanceSurface.total,
      winner: winnerBreakdown.distanceSurface.total,
      max: 20
    },
    {
      name: 'Equipment',
      loser: loserBreakdown.equipment.total,
      winner: winnerBreakdown.equipment.total,
      max: 8
    },
    {
      name: 'Trainer Patterns',
      loser: loserBreakdown.trainerPatterns.total,
      winner: winnerBreakdown.trainerPatterns.total,
      max: 8
    },
    {
      name: 'Track Specialist',
      loser: loserBreakdown.trackSpecialist.total,
      winner: winnerBreakdown.trackSpecialist.total,
      max: 10
    },
    {
      name: 'Combo Patterns',
      loser: loserBreakdown.comboPatterns.total,
      winner: winnerBreakdown.comboPatterns.total,
      max: 4
    },
  ];

  console.log('\n');
  console.log('┌─────────────────────────┬─────────────────────────┬─────────────────────────┬───────────┐');
  console.log('│        CATEGORY         │   MAGIC RED (Loser)     │    ARAUCANO (Winner)    │   DELTA   │');
  console.log('├─────────────────────────┼─────────────────────────┼─────────────────────────┼───────────┤');

  let totalLoser = 0;
  let totalWinner = 0;
  const deltas: { name: string; delta: number; loser: number; winner: number }[] = [];

  for (const cat of categories) {
    const delta = cat.loser - cat.winner;
    deltas.push({ name: cat.name, delta, loser: cat.loser, winner: cat.winner });
    totalLoser += cat.loser;
    totalWinner += cat.winner;

    const deltaStr = delta > 0 ? `+${delta}` : delta.toString();
    const deltaColor = delta > 10 ? ' ⚠️' : delta < -10 ? ' ✓' : '';

    console.log(
      `│ ${cat.name.padEnd(23)} │     ${cat.loser.toString().padStart(3)} / ${cat.max.toString().padEnd(3)} pts        │     ${cat.winner.toString().padStart(3)} / ${cat.max.toString().padEnd(3)} pts        │  ${deltaStr.padStart(4)}${deltaColor}  │`
    );
  }

  // Add overlay
  const overlayLoser = ourLoser.score.overlayScore;
  const overlayWinner = winner.score.overlayScore;
  const overlayDelta = overlayLoser - overlayWinner;
  console.log('├─────────────────────────┼─────────────────────────┼─────────────────────────┼───────────┤');
  console.log(
    `│ Overlay Adjustment      │     ${overlayLoser >= 0 ? '+' : ''}${overlayLoser.toString().padStart(2)} pts             │     ${overlayWinner >= 0 ? '+' : ''}${overlayWinner.toString().padStart(2)} pts             │  ${overlayDelta > 0 ? '+' : ''}${overlayDelta.toString().padStart(3)}    │`
  );

  console.log('├─────────────────────────┼─────────────────────────┼─────────────────────────┼───────────┤');
  console.log(
    `│ BASE SCORE TOTAL        │        ${ourLoser.score.baseScore.toString().padStart(3)} pts           │        ${winner.score.baseScore.toString().padStart(3)} pts           │  ${(ourLoser.score.baseScore - winner.score.baseScore > 0 ? '+' : '') + (ourLoser.score.baseScore - winner.score.baseScore).toString().padStart(3)}    │`
  );
  console.log(
    `│ FINAL SCORE             │        ${ourLoser.score.total.toString().padStart(3)} pts           │        ${winner.score.total.toString().padStart(3)} pts           │  ${(ourLoser.score.total - winner.score.total > 0 ? '+' : '') + (ourLoser.score.total - winner.score.total).toString().padStart(3)}    │`
  );
  console.log('└─────────────────────────┴─────────────────────────┴─────────────────────────┴───────────┘');

  // Find the "Liar" categories - where loser got massive undeserved advantage
  console.log('\n\n' + '═'.repeat(80));
  console.log('                    DIAGNOSIS: THE "LIAR" CATEGORIES');
  console.log('═'.repeat(80));

  const sortedDeltas = [...deltas].sort((a, b) => b.delta - a.delta);
  console.log('\nCategories where LOSER had biggest advantage over WINNER:');
  console.log('─'.repeat(60));

  for (const d of sortedDeltas.slice(0, 5)) {
    if (d.delta > 0) {
      console.log(`  ${d.name.padEnd(20)}: +${d.delta} pts advantage (${d.loser} vs ${d.winner})`);
    }
  }

  // Deep dive into the biggest liars
  console.log('\n\n' + '═'.repeat(80));
  console.log('                    DEEP DIVE: DETAILED CATEGORY ANALYSIS');
  console.log('═'.repeat(80));

  // Speed analysis
  console.log('\n📊 SPEED ANALYSIS:');
  console.log('─'.repeat(60));
  console.log(`  Magic Red:  Best Figure = ${loserBreakdown.speedClass.bestFigure ?? 'N/A'}`);
  console.log(`              Speed Score = ${loserBreakdown.speedClass.speedScore} pts`);
  console.log(`              Reasoning: ${loserBreakdown.speedClass.reasoning}`);
  console.log(`  Araucano:   Best Figure = ${winnerBreakdown.speedClass.bestFigure ?? 'N/A'}`);
  console.log(`              Speed Score = ${winnerBreakdown.speedClass.speedScore} pts`);
  console.log(`              Reasoning: ${winnerBreakdown.speedClass.reasoning}`);

  // Form analysis
  console.log('\n📈 FORM ANALYSIS:');
  console.log('─'.repeat(60));
  console.log(`  Magic Red:  Form Score = ${loserBreakdown.form.total} pts`);
  console.log(`              Recent Form = ${loserBreakdown.form.recentFormScore}, Layoff = ${loserBreakdown.form.layoffScore}, Consistency = ${loserBreakdown.form.consistencyBonus}`);
  console.log(`              Form Trend = ${loserBreakdown.form.formTrend}`);
  console.log(`              Won Last Out: ${loserBreakdown.form.wonLastOut}, Won 2/3: ${loserBreakdown.form.won2OfLast3}`);
  console.log(`              Reasoning: ${loserBreakdown.form.reasoning}`);
  console.log(`  Araucano:   Form Score = ${winnerBreakdown.form.total} pts`);
  console.log(`              Recent Form = ${winnerBreakdown.form.recentFormScore}, Layoff = ${winnerBreakdown.form.layoffScore}, Consistency = ${winnerBreakdown.form.consistencyBonus}`);
  console.log(`              Form Trend = ${winnerBreakdown.form.formTrend}`);
  console.log(`              Won Last Out: ${winnerBreakdown.form.wonLastOut}, Won 2/3: ${winnerBreakdown.form.won2OfLast3}`);
  console.log(`              Reasoning: ${winnerBreakdown.form.reasoning}`);

  // Pace analysis
  console.log('\n🏃 PACE ANALYSIS:');
  console.log('─'.repeat(60));
  console.log(`  Magic Red:  Pace Score = ${loserBreakdown.pace.total} pts`);
  console.log(`              Running Style = ${loserBreakdown.pace.runningStyle}, Pace Fit = ${loserBreakdown.pace.paceFit}`);
  console.log(`              Reasoning: ${loserBreakdown.pace.reasoning}`);
  console.log(`  Araucano:   Pace Score = ${winnerBreakdown.pace.total} pts`);
  console.log(`              Running Style = ${winnerBreakdown.pace.runningStyle}, Pace Fit = ${winnerBreakdown.pace.paceFit}`);
  console.log(`              Reasoning: ${winnerBreakdown.pace.reasoning}`);

  // Connections analysis
  console.log('\n🤝 CONNECTIONS ANALYSIS:');
  console.log('─'.repeat(60));
  console.log(`  Magic Red:  Connections = ${loserBreakdown.connections.total} pts`);
  console.log(`              Trainer = ${loserBreakdown.connections.trainer}, Jockey = ${loserBreakdown.connections.jockey}, Partnership = ${loserBreakdown.connections.partnershipBonus}`);
  console.log(`              Reasoning: ${loserBreakdown.connections.reasoning}`);
  console.log(`  Araucano:   Connections = ${winnerBreakdown.connections.total} pts`);
  console.log(`              Trainer = ${winnerBreakdown.connections.trainer}, Jockey = ${winnerBreakdown.connections.jockey}, Partnership = ${winnerBreakdown.connections.partnershipBonus}`);
  console.log(`              Reasoning: ${winnerBreakdown.connections.reasoning}`);

  // Class analysis
  console.log('\n🏆 CLASS ANALYSIS:');
  console.log('─'.repeat(60));
  console.log(`  Magic Red:  Class Score = ${loserBreakdown.speedClass.classScore} pts`);
  console.log(`              Class Movement = ${loserBreakdown.speedClass.classMovement}`);
  if (loserBreakdown.classAnalysis) {
    console.log(`              Hidden Drops = ${loserBreakdown.classAnalysis.hiddenDropsScore} pts, Value Play = ${loserBreakdown.classAnalysis.isValuePlay}`);
  }
  console.log(`  Araucano:   Class Score = ${winnerBreakdown.speedClass.classScore} pts`);
  console.log(`              Class Movement = ${winnerBreakdown.speedClass.classMovement}`);
  if (winnerBreakdown.classAnalysis) {
    console.log(`              Hidden Drops = ${winnerBreakdown.classAnalysis.hiddenDropsScore} pts, Value Play = ${winnerBreakdown.classAnalysis.isValuePlay}`);
  }

  // Paper Tiger check
  console.log('\n🐅 PAPER TIGER CHECK:');
  console.log('─'.repeat(60));
  if (loserBreakdown.paperTiger) {
    console.log(`  Magic Red:  Penalty Applied = ${loserBreakdown.paperTiger.penaltyApplied}`);
    console.log(`              Penalty Amount = ${loserBreakdown.paperTiger.penaltyAmount}`);
    console.log(`              Reasoning: ${loserBreakdown.paperTiger.reasoning}`);
  }
  if (winnerBreakdown.paperTiger) {
    console.log(`  Araucano:   Penalty Applied = ${winnerBreakdown.paperTiger.penaltyApplied}`);
    console.log(`              Penalty Amount = ${winnerBreakdown.paperTiger.penaltyAmount}`);
    console.log(`              Reasoning: ${winnerBreakdown.paperTiger.reasoning}`);
  }

  // Age analysis
  console.log('\n📅 AGE & RECENCY ANALYSIS:');
  console.log('─'.repeat(60));
  if (loserBreakdown.ageAnalysis) {
    console.log(`  Magic Red:  Age = ${loserBreakdown.ageAnalysis.age}, Peak Status = ${loserBreakdown.ageAnalysis.peakStatus}`);
  }
  if (winnerBreakdown.ageAnalysis) {
    console.log(`  Araucano:   Age = ${winnerBreakdown.ageAnalysis.age}, Peak Status = ${winnerBreakdown.ageAnalysis.peakStatus}`);
  }

  // Check raw horse data for layoff
  console.log('\n📊 RAW HORSE DATA:');
  console.log('─'.repeat(60));
  console.log(`  Magic Red:  Days Since Last Race = ${ourLoser.horse.daysSinceLastRace ?? 'N/A'}`);
  console.log(`              Lifetime Starts = ${ourLoser.horse.lifetimeStarts ?? 'N/A'}`);
  console.log(`              Lifetime Wins = ${ourLoser.horse.lifetimeWins ?? 'N/A'}`);
  console.log(`              Recent PPs: ${ourLoser.horse.pastPerformances.length}`);
  if (ourLoser.horse.pastPerformances.length > 0) {
    const pp = ourLoser.horse.pastPerformances[0];
    console.log(`              Last Race: ${pp.date} - Finish ${pp.finishPosition}/${pp.numStarters}, Beyer ${pp.speedFigures?.beyer ?? 'N/A'}`);
  }
  console.log(`  Araucano:   Days Since Last Race = ${winner.horse.daysSinceLastRace ?? 'N/A'}`);
  console.log(`              Lifetime Starts = ${winner.horse.lifetimeStarts ?? 'N/A'}`);
  console.log(`              Lifetime Wins = ${winner.horse.lifetimeWins ?? 'N/A'}`);
  console.log(`              Recent PPs: ${winner.horse.pastPerformances.length}`);
  if (winner.horse.pastPerformances.length > 0) {
    const pp = winner.horse.pastPerformances[0];
    console.log(`              Last Race: ${pp.date} - Finish ${pp.finishPosition}/${pp.numStarters}, Beyer ${pp.speedFigures?.beyer ?? 'N/A'}`);
  }

  // Final diagnosis
  console.log('\n\n' + '█'.repeat(80));
  console.log('                         FINAL DIAGNOSIS');
  console.log('█'.repeat(80));

  const biggestLiar = sortedDeltas[0];
  if (biggestLiar) {
    console.log(`\n🔍 PRIMARY "LIAR" CATEGORY: ${biggestLiar.name}`);
    console.log(`   Magic Red got +${biggestLiar.delta} pts more than Araucano in this category.`);
    console.log(`   (${biggestLiar.loser} pts vs ${biggestLiar.winner} pts)`);

    if (biggestLiar.name === 'Form') {
      console.log('\n⚠️  FORM is likely overvaluing horses with high recent finish scores');
      console.log('   but ignoring important context like actual race competitiveness.');
    } else if (biggestLiar.name === 'Speed Score') {
      console.log('\n⚠️  SPEED is likely overvaluing historical peak figures');
      console.log('   without considering recency/currency of those figures.');
    } else if (biggestLiar.name === 'Class Score') {
      console.log('\n⚠️  CLASS is likely overvaluing horses from higher class levels');
      console.log('   without considering how long ago that class level was achieved.');
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('Diagnosis complete.');
  console.log('═'.repeat(80) + '\n');
}

// Run
diagnoseRace().catch(console.error);
