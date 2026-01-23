#!/usr/bin/env npx tsx
/**
 * Quick validation test - runs only 2 races to verify the flow
 * Uses the same logic as validate-ai-architecture.ts
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
import type { ParsedRace, HorseEntry } from '../src/types/drf';
import type { RaceScoringResult, HorseScoreForAI } from '../src/types/scoring';
import type { ScoredHorse } from '../src/lib/scoring';
import type { AIRaceAnalysis } from '../src/services/ai/types';
import { analyzePaceScenario } from '../src/lib/scoring';

const DATA_DIR = path.join(__dirname, '../src/data');

function convertToRaceScoringResult(
  scoredHorses: ScoredHorse[],
  horses: HorseEntry[]
): RaceScoringResult {
  const sortedByRank = [...scoredHorses]
    .filter((h) => !h.score.isScratched)
    .sort((a, b) => a.rank - b.rank);

  const scores: HorseScoreForAI[] = sortedByRank.map((sh) => {
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

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
      positiveFactors,
      negativeFactors,
      isScratched: false,
      morningLineOdds: horse.morningLineOdds || '5-1',
      morningLineDecimal: horse.morningLineDecimal || 5.0,
      pastPerformances: (horse.pastPerformances || []).slice(0, 3).map((pp) => ({
        date: pp.date,
        track: pp.track,
        distance: pp.distanceFurlongs,
        surface: pp.surface,
        trackCondition: pp.trackCondition,
        finishPosition: pp.finishPosition,
        fieldSize: pp.fieldSize,
        lengthsBehind: pp.lengthsBehind,
        beyer: pp.speedFigures?.beyer ?? null,
        earlyPace1: pp.earlyPace1 ?? null,
        latePace: pp.latePace ?? null,
        tripComment: pp.tripComment || '',
        odds: pp.odds ?? null,
        favoriteRank: pp.favoriteRank ?? null,
        runningLine: {
          start: pp.runningLine?.start ?? null,
          stretch: pp.runningLine?.stretch ?? null,
          finish: pp.runningLine?.finish ?? null,
        },
      })),
      workouts: [],
      trainerPatterns: {} as unknown as HorseScoreForAI['trainerPatterns'],
      equipment: {} as unknown as HorseScoreForAI['equipment'],
      breeding: {} as unknown as HorseScoreForAI['breeding'],
      distanceSurfaceStats: {} as unknown as HorseScoreForAI['distanceSurfaceStats'],
      formIndicators: {} as unknown as HorseScoreForAI['formIndicators'],
    };
  });

  const activeHorses = horses.filter((h) => !h.isScratched);
  const paceScenario = analyzePaceScenario(activeHorses);

  return {
    scores,
    raceAnalysis: {
      paceScenario: {
        expectedPace: 'moderate' as const,
        likelyLeader: sortedByRank[0]?.horse.postPosition || 1,
        speedDuelProbability: paceScenario.ppi / 100,
        earlySpeedCount: paceScenario.styleBreakdown?.earlySpeed?.length || 0,
      },
      fieldStrength: 'average' as const,
      vulnerableFavorite: false,
      likelyPaceCollapse: false,
      trackIntelligence: null,
    },
  };
}

interface RaceAnalysisData {
  race: ParsedRace;
  scoredHorses: ScoredHorse[];
  scoringResult: RaceScoringResult;
  aiAnalysis?: AIRaceAnalysis;
}

async function main() {
  console.log('\n=== QUICK VALIDATION TEST ===\n');

  const status = checkAIServiceStatus();
  if (status !== 'ready') {
    console.error(`AI Service Status: ${status}. Set GEMINI_API_KEY.`);
    process.exit(1);
  }
  console.log('AI Service Status: ready\n');

  const files = fs.readdirSync(DATA_DIR);
  const drfFiles = files.filter((f) => f.endsWith('.DRF') && f !== 'sample.DRF');

  if (drfFiles.length === 0) {
    console.error('No DRF files found');
    process.exit(1);
  }

  const drfPath = path.join(DATA_DIR, drfFiles[0]);
  console.log(`Using: ${drfFiles[0]}\n`);

  const drfContent = fs.readFileSync(drfPath, 'utf-8');
  const parsed = parseDRFFile(drfContent, path.basename(drfPath));

  // Only process first 2 races
  const racesToProcess = parsed.races.slice(0, 2);
  console.log(`Processing ${racesToProcess.length} races...\n`);

  const allRaces: RaceAnalysisData[] = [];

  for (const race of racesToProcess) {
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

    allRaces.push({
      race,
      scoredHorses,
      scoringResult,
    });
  }

  console.log('Running AI analysis...\n');

  for (const raceData of allRaces) {
    try {
      const aiAnalysis = await getMultiBotAnalysis(raceData.race, raceData.scoringResult, {
        forceRefresh: true,
        recordMetrics: false,
      });
      raceData.aiAnalysis = aiAnalysis;

      console.log(`Race ${raceData.race.header.raceNumber}:`);
      console.log(`  aiAnalysis: exists`);
      console.log(`  ticketConstruction: ${aiAnalysis.ticketConstruction ? 'exists' : 'MISSING'}`);
      console.log(`  betConstruction: ${aiAnalysis.betConstruction ? 'exists' : 'MISSING'}`);

      if (aiAnalysis.ticketConstruction) {
        console.log(`  template: ${aiAnalysis.ticketConstruction.template}`);
        console.log(`  algorithmTop4: ${aiAnalysis.ticketConstruction.algorithmTop4}`);
        console.log(`  sizing: ${aiAnalysis.ticketConstruction.sizing?.recommendation}`);
      }
      console.log();
    } catch (error) {
      console.error(`Error on Race ${raceData.race.header.raceNumber}:`, error);
    }
  }

  // Now simulate the filter
  const racesWithAI = allRaces.filter(
    (r) => r.aiAnalysis?.ticketConstruction || r.aiAnalysis?.betConstruction
  );

  console.log('\n=== FILTER RESULTS ===');
  console.log(`Total races: ${allRaces.length}`);
  console.log(`Races with aiAnalysis: ${allRaces.filter((r) => r.aiAnalysis).length}`);
  console.log(
    `Races with ticketConstruction: ${allRaces.filter((r) => r.aiAnalysis?.ticketConstruction).length}`
  );
  console.log(
    `Races with betConstruction: ${allRaces.filter((r) => r.aiAnalysis?.betConstruction).length}`
  );
  console.log(`Races passing filter (racesWithAI): ${racesWithAI.length}`);

  // Test the template extraction
  console.log('\n=== TEMPLATE EXTRACTION ===');
  for (const raceData of racesWithAI) {
    const ticketConstruction = raceData.aiAnalysis!.ticketConstruction;
    const betConstruction = raceData.aiAnalysis!.betConstruction;

    console.log(`Race ${raceData.race.header.raceNumber}:`);
    if (ticketConstruction) {
      console.log(`  Using ticketConstruction path`);
      console.log(`  template: ${ticketConstruction.template}`);
      console.log(`  sizing.recommendation: ${ticketConstruction.sizing?.recommendation}`);
      console.log(`  verdict.action: ${ticketConstruction.verdict?.action}`);
    } else if (betConstruction) {
      console.log(`  Using betConstruction (legacy) path`);
      console.log(`  algorithmTop4: ${betConstruction.algorithmTop4}`);
    } else {
      console.log(`  >>> NO CONSTRUCTION DATA! <<<`);
    }
  }

  console.log('\n=== DONE ===');
}

main();
