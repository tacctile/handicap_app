import * as fs from 'fs';

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║           SCORING INTEGRITY REPORT                               ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Generated:', new Date().toISOString());
console.log('');

// ============================================================
// PART 1: SCORING TYPE DEFINITIONS
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 1: SCORING TYPE DEFINITIONS                                 │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

try {
  const typesFile = fs.readFileSync('./src/types/drf.ts', 'utf-8');

  // Find HorseScore interface
  const scoreMatch = typesFile.match(/interface HorseScore \{[\s\S]*?\n\}/);
  if (scoreMatch) {
    console.log('HorseScore interface:');
    console.log(scoreMatch[0]);
  }

  // Find ScoreBreakdown interface
  const breakdownMatch = typesFile.match(/interface ScoreBreakdown \{[\s\S]*?\n\}/);
  if (breakdownMatch) {
    console.log('\nScoreBreakdown interface:');
    console.log(breakdownMatch[0]);
  }
} catch (e) {
  console.log('Could not read types file:', e);
}
console.log('');

// ============================================================
// PART 2: SCORING MODULE STRUCTURE
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 2: SCORING MODULE STRUCTURE                                 │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

// List all files in scoring directory
try {
  const scoringDir = './src/lib/scoring';
  if (fs.existsSync(scoringDir)) {
    const files = fs.readdirSync(scoringDir);
    console.log('Files in src/lib/scoring/:');
    files.forEach(f => console.log('  - ' + f));
  } else {
    console.log('Scoring directory not found at:', scoringDir);

    // Try to find scoring-related files
    console.log('\nSearching for scoring-related files...');
    const libDir = './src/lib';
    if (fs.existsSync(libDir)) {
      const libFiles = fs.readdirSync(libDir);
      libFiles.forEach(f => {
        if (f.toLowerCase().includes('scor')) {
          console.log('  Found: src/lib/' + f);
        }
      });
    }
  }
} catch (e) {
  console.log('Error reading scoring directory:', e);
}
console.log('');

// ============================================================
// PART 3: MAIN SCORING FUNCTION
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 3: MAIN SCORING FUNCTION                                    │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

// Find and display the main scoring function
const scoringPaths = [
  './src/lib/scoring/index.ts',
  './src/lib/scoring.ts',
  './src/lib/scoring/scorer.ts',
  './src/lib/scoring/calculateScore.ts',
];

let scoringFileContent = '';
let scoringFilePath = '';

for (const path of scoringPaths) {
  try {
    if (fs.existsSync(path)) {
      scoringFileContent = fs.readFileSync(path, 'utf-8');
      scoringFilePath = path;
      console.log('Found scoring file at:', path);
      break;
    }
  } catch (e) {}
}

if (scoringFileContent) {
  // Show the main scoring function
  console.log('\nMain scoring function (first 3000 chars):');
  console.log(scoringFileContent.slice(0, 3000));
  console.log('...[truncated]');
} else {
  console.log('Could not find main scoring file');
}
console.log('');

// ============================================================
// PART 4: INDIVIDUAL SCORING CATEGORIES
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 4: INDIVIDUAL SCORING CATEGORIES                            │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

// v2.0 - Industry-Aligned Weights (total: 240)
const categories = [
  { name: 'Speed/Class', max: 80, files: ['speed', 'class', 'speedClass'] },  // 33.3% - Most predictive
  { name: 'Pace', max: 45, files: ['pace', 'paceFit'] },                       // 18.8% - Race shape
  { name: 'Form', max: 40, files: ['form', 'recentForm'] },                    // 16.7% - Recent performance
  { name: 'Post Position', max: 30, files: ['post', 'postPosition', 'trackBias'] }, // 12.5% - Situational
  { name: 'Connections', max: 25, files: ['connections', 'trainer', 'jockey'] }, // 10.4% - Modifier
  { name: 'Equipment', max: 20, files: ['equipment'] },                        // 8.3% - Fine-tuning
];

categories.forEach(cat => {
  console.log(`\n--- ${cat.name} (Max: ${cat.max} points) ---`);

  // Look for relevant files
  cat.files.forEach(filename => {
    const paths = [
      `./src/lib/scoring/${filename}.ts`,
      `./src/lib/${filename}.ts`,
      `./src/lib/scoring/${filename}Score.ts`,
    ];

    for (const path of paths) {
      try {
        if (fs.existsSync(path)) {
          const content = fs.readFileSync(path, 'utf-8');
          console.log(`  Found: ${path}`);

          // Extract function signatures
          const funcMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+\([^)]*\)/g);
          if (funcMatches) {
            console.log('  Functions:');
            funcMatches.slice(0, 5).forEach(f => console.log('    - ' + f));
          }
          break;
        }
      } catch (e) {}
    }
  });
});
console.log('');

// ============================================================
// PART 5: CONNECTIONS SCORING LOGIC (25 points - v2.0)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 5: CONNECTIONS SCORING LOGIC (25 points - v2.0)             │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

// Find connections scoring
const connectionsPaths = [
  './src/lib/scoring/connections.ts',
  './src/lib/scoring/trainer.ts',
  './src/lib/scoring/jockey.ts',
];

connectionsPaths.forEach(path => {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      console.log(`\n${path}:`);
      console.log(content.slice(0, 2000));
      if (content.length > 2000) console.log('...[truncated]');
    }
  } catch (e) {}
});
console.log('');

// ============================================================
// PART 6: SPEED/CLASS SCORING LOGIC (50 points)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 6: SPEED/CLASS SCORING LOGIC (50 points)                    │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

const speedPaths = [
  './src/lib/scoring/speedClass.ts',
  './src/lib/scoring/speed.ts',
  './src/lib/class/classAnalysis.ts',
];

speedPaths.forEach(path => {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      console.log(`\n${path}:`);
      console.log(content.slice(0, 2000));
      if (content.length > 2000) console.log('...[truncated]');
    }
  } catch (e) {}
});
console.log('');

// ============================================================
// PART 7: FORM SCORING LOGIC (30 points)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 7: FORM SCORING LOGIC (30 points)                           │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

const formPaths = [
  './src/lib/scoring/form.ts',
  './src/lib/scoring/recentForm.ts',
];

formPaths.forEach(path => {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      console.log(`\n${path}:`);
      console.log(content.slice(0, 2000));
      if (content.length > 2000) console.log('...[truncated]');
    }
  } catch (e) {}
});
console.log('');

// ============================================================
// PART 8: POST POSITION SCORING LOGIC (45 points)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 8: POST POSITION SCORING LOGIC (45 points)                  │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

const postPaths = [
  './src/lib/scoring/postPosition.ts',
  './src/lib/scoring/post.ts',
  './src/data/tracks/trackBias.ts',
];

postPaths.forEach(path => {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      console.log(`\n${path}:`);
      console.log(content.slice(0, 2000));
      if (content.length > 2000) console.log('...[truncated]');
    }
  } catch (e) {}
});
console.log('');

// ============================================================
// PART 9: EQUIPMENT SCORING LOGIC (25 points)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 9: EQUIPMENT SCORING LOGIC (25 points)                      │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

const equipPaths = [
  './src/lib/scoring/equipment.ts',
];

equipPaths.forEach(path => {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      console.log(`\n${path}:`);
      console.log(content.slice(0, 2000));
      if (content.length > 2000) console.log('...[truncated]');
    }
  } catch (e) {}
});
console.log('');

// ============================================================
// PART 10: PACE SCORING LOGIC (40 points)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 10: PACE SCORING LOGIC (40 points)                          │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

const pacePaths = [
  './src/lib/scoring/pace.ts',
  './src/lib/scoring/paceFit.ts',
];

pacePaths.forEach(path => {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      console.log(`\n${path}:`);
      console.log(content.slice(0, 2000));
      if (content.length > 2000) console.log('...[truncated]');
    }
  } catch (e) {}
});
console.log('');

// ============================================================
// PART 11: FAIR ODDS / VALUE CALCULATION
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 11: FAIR ODDS / VALUE CALCULATION                           │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

const valuePaths = [
  './src/lib/value/valueDetector.ts',
  './src/lib/value/fairOdds.ts',
  './src/lib/betting/tierClassification.ts',
  './src/lib/betting/odds.ts',
];

valuePaths.forEach(path => {
  try {
    if (fs.existsSync(path)) {
      const content = fs.readFileSync(path, 'utf-8');
      console.log(`\n${path}:`);
      console.log(content.slice(0, 2000));
      if (content.length > 2000) console.log('...[truncated]');
    }
  } catch (e) {}
});
console.log('');

// ============================================================
// PART 12: SCORING INPUT VERIFICATION
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 12: SCORING INPUT VERIFICATION                              │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('Checklist - Does the scoring system receive these inputs?');
console.log('');
console.log('SPEED/CLASS (80 pts - 33.3%):');
console.log('  [ ] Speed figures (bestBeyer, averageBeyer, lastBeyer)');
console.log('  [ ] Class level (classification, purse, claimingPrice)');
console.log('  [ ] Class movement (up/down in class)');
console.log('');
console.log('PACE (45 pts - 18.8%):');
console.log('  [ ] Running style (runningStyle, earlySpeedRating)');
console.log('  [ ] Race pace scenario');
console.log('  [ ] Track pace bias');
console.log('');
console.log('FORM (40 pts - 16.7%):');
console.log('  [ ] Recent finishes (pastPerformances)');
console.log('  [ ] Days since last race (daysSinceLastRace)');
console.log('  [ ] Consistency (lifetimeWins/lifetimeStarts)');
console.log('  [ ] Current form trend');
console.log('');
console.log('POST POSITION (30 pts - 12.5%):');
console.log('  [ ] Post position number (postPosition)');
console.log('  [ ] Track code (trackCode)');
console.log('  [ ] Distance (distanceFurlongs)');
console.log('  [ ] Surface (surface)');
console.log('  [ ] Track bias data');
console.log('');
console.log('CONNECTIONS (25 pts - 10.4%):');
console.log('  [ ] Trainer name and stats (trainerName, trainerStats)');
console.log('  [ ] Jockey name and stats (jockeyName, jockeyStats)');
console.log('  [ ] Trainer/Jockey combo history');
console.log('');
console.log('EQUIPMENT (20 pts - 8.3%):');
console.log('  [ ] Current equipment (equipment object)');
console.log('  [ ] Equipment changes (firstTimeEquipment)');
console.log('  [ ] Medication (medication object)');
console.log('');

// ============================================================
// PART 13: SUMMARY
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 13: SUMMARY                                                 │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');
console.log('Review the output above and identify:');
console.log('1. Which scoring modules exist');
console.log('2. What inputs each module receives');
console.log('3. How scores are calculated');
console.log('4. How fair odds are derived');
console.log('5. Any gaps or disconnects in the pipeline');
console.log('');

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║                 END OF SCORING INTEGRITY REPORT                  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
