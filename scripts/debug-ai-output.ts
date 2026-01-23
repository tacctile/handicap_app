#!/usr/bin/env npx tsx
/**
 * Debug script to trace AI output structure
 * Tests a single race to see what fields exist in the output
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { parseDRFFile } from '../src/lib/drfParser';
import { calculateRaceScores } from '../src/lib/scoring';
import { getMultiBotAnalysis, checkAIServiceStatus } from '../src/services/ai';
import type { RaceScoringResult, HorseScoreForAI } from '../src/types/scoring';
import { analyzePaceScenario } from '../src/lib/scoring';

const DATA_DIR = path.join(__dirname, '../src/data');

import type { ScoredHorse } from '../src/lib/scoring';
import type { HorseEntry } from '../src/types/drf';

// Convert ScoredHorse to RaceScoringResult (simplified from validation script)
function convertToRaceScoringResult(
  scoredHorses: ScoredHorse[],
  horses: HorseEntry[]
): RaceScoringResult {
  const sortedByRank = [...scoredHorses]
    .filter((h) => !h.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  const scores: HorseScoreForAI[] = sortedByRank.map((sh) => {
    const horse = sh.horse;
    return {
      programNumber: horse.postPosition,
      horseName: horse.horseName,
      rank: sh.rank,
      finalScore: sh.score.total,
      confidenceTier: sh.score.confidenceLevel,
      breakdown: {
        speedScore: sh.score.breakdown.speedClass.speedScore,
        classScore: sh.score.breakdown.speedClass.classScore,
        formScore: sh.score.breakdown.form.total,
        paceScore: sh.score.breakdown.pace.total,
        connectionScore: sh.score.breakdown.connections.total,
      },
      positiveFactors: [],
      negativeFactors: [],
      isScratched: false,
      morningLineOdds: horse.morningLineOdds || '5-1',
      morningLineDecimal: horse.morningLineDecimal || 5.0,
      pastPerformances: [],
      workouts: [],
      trainerPatterns: {} as unknown as HorseScoreForAI['trainerPatterns'],
      equipment: {} as unknown as HorseScoreForAI['equipment'],
      breeding: {} as unknown as HorseScoreForAI['breeding'],
      distanceSurfaceStats: {} as unknown as HorseScoreForAI['distanceSurfaceStats'],
      formIndicators: {} as unknown as HorseScoreForAI['formIndicators'],
    };
  });

  const paceScenario = analyzePaceScenario(horses.filter((h: HorseEntry) => !h.isScratched));

  return {
    scores,
    raceAnalysis: {
      paceScenario: {
        expectedPace: 'moderate',
        likelyLeader: sortedByRank[0]?.horse.postPosition || 1,
        speedDuelProbability: paceScenario.ppi / 100,
        earlySpeedCount: paceScenario.styleBreakdown?.earlySpeed?.length || 0,
      },
      fieldStrength: 'average',
      vulnerableFavorite: false,
      likelyPaceCollapse: false,
      trackIntelligence: null,
    },
  };
}

async function main() {
  console.log('\n=== AI OUTPUT DEBUG ===\n');

  // Check API key
  const status = checkAIServiceStatus();
  if (status !== 'ready') {
    console.error(`AI Service Status: ${status}. Set GEMINI_API_KEY.`);
    process.exit(1);
  }
  console.log('AI Service Status: ready\n');

  // Find a DRF file
  const files = fs.readdirSync(DATA_DIR);
  const drfFiles = files.filter((f) => f.endsWith('.DRF') && f !== 'sample.DRF');

  if (drfFiles.length === 0) {
    console.error('No DRF files found');
    process.exit(1);
  }

  const drfPath = path.join(DATA_DIR, drfFiles[0]);
  console.log(`Using DRF file: ${drfFiles[0]}\n`);

  const drfContent = fs.readFileSync(drfPath, 'utf-8');
  const parsed = parseDRFFile(drfContent, path.basename(drfPath));

  if (parsed.races.length === 0) {
    console.error('No races in DRF file');
    process.exit(1);
  }

  const race = parsed.races[0];
  console.log(`Testing Race ${race.header.raceNumber} at ${race.header.trackCode}\n`);

  // Score the race
  const getOdds = (index: number, originalOdds: string) =>
    originalOdds || race.horses[index]?.morningLineOdds || '5-1';
  const isScratched = () => false;
  const trackCondition = race.header.trackCondition || 'fast';

  const scoredHorses = calculateRaceScores(
    race.horses,
    race.header,
    getOdds,
    isScratched,
    trackCondition
  );

  const scoringResult = convertToRaceScoringResult(scoredHorses, race.horses);

  console.log('Running AI analysis...\n');

  try {
    const aiAnalysis = await getMultiBotAnalysis(race, scoringResult, {
      forceRefresh: true,
      recordMetrics: false,
    });

    console.log('\n=== AI ANALYSIS RESULT ===\n');

    // Check what fields exist
    console.log('Top-level fields in aiAnalysis:');
    console.log(Object.keys(aiAnalysis));

    console.log('\n--- ticketConstruction check ---');
    console.log('ticketConstruction exists:', aiAnalysis.ticketConstruction !== undefined);
    console.log('ticketConstruction type:', typeof aiAnalysis.ticketConstruction);

    if (aiAnalysis.ticketConstruction) {
      console.log('\nticketConstruction fields:');
      console.log(Object.keys(aiAnalysis.ticketConstruction));
      console.log('\nticketConstruction values:');
      console.log('  template:', aiAnalysis.ticketConstruction.template);
      console.log('  algorithmTop4:', aiAnalysis.ticketConstruction.algorithmTop4);
      console.log('  favoriteStatus:', aiAnalysis.ticketConstruction.favoriteStatus);
      console.log('  sizing:', aiAnalysis.ticketConstruction.sizing);
      console.log('  verdict:', aiAnalysis.ticketConstruction.verdict);
    } else {
      console.log('\n>>> ticketConstruction is MISSING! <<<');
    }

    console.log('\n--- betConstruction check ---');
    console.log('betConstruction exists:', aiAnalysis.betConstruction !== undefined);
    console.log('betConstruction type:', typeof aiAnalysis.betConstruction);

    if (aiAnalysis.betConstruction) {
      console.log('\nbetConstruction fields:');
      console.log(Object.keys(aiAnalysis.betConstruction));
      console.log('\nbetConstruction.algorithmTop4:', aiAnalysis.betConstruction.algorithmTop4);
    }

    console.log('\n--- Other key fields ---');
    console.log('raceId:', aiAnalysis.raceId);
    console.log('topPick:', aiAnalysis.topPick);
    console.log('confidence:', aiAnalysis.confidence);
    console.log('bettableRace:', aiAnalysis.bettableRace);
    console.log('horseInsights count:', aiAnalysis.horseInsights?.length);
    console.log('botDebugInfo:', aiAnalysis.botDebugInfo ? 'exists' : 'missing');

    console.log('\n=== FULL AI ANALYSIS OBJECT ===\n');
    console.log(JSON.stringify(aiAnalysis, null, 2));
  } catch (error) {
    console.error('\nError during AI analysis:', error);
  }
}

main();
