/**
 * Debug script to dump raw workout field values from a DRF file
 * Run with: npx ts-node scripts/debug-workout-fields.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple CSV parser
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === undefined) continue;

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());

  return fields;
}

// Read the sample DRF file
const samplePath = path.join(__dirname, '../src/data/sample.DRF');
const content = fs.readFileSync(samplePath, 'utf-8');

// Get first few lines (each line is a horse)
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

console.log(`\n=== DRF FILE DEBUG: ${lines.length} horses found ===\n`);

// Parse just the first horse entry for analysis
if (lines.length > 0) {
  const firstLine = lines[0];
  const fields = parseCSVLine(firstLine!);

  console.log(`Total fields in first horse record: ${fields.length}`);
  console.log(`Horse name (field 44): "${fields[44]}"`);
  console.log();

  // Dump workout-related fields (255-400)
  console.log('========== RAW WORKOUT FIELD DUMP ==========');

  console.log('\n--- Fields 255-275 (Dates & Days Since) ---');
  for (let i = 255; i < 276; i++) {
    const val = fields[i];
    if (val && val.trim()) console.log(`  Field ${i}: "${val}"`);
  }

  console.log('\n--- Fields 276-295 (Track Codes - 20 fields for 10 works) ---');
  for (let i = 276; i < 296; i++) {
    const val = fields[i];
    if (val && val.trim()) console.log(`  Field ${i}: "${val}"`);
  }

  console.log('\n--- Fields 296-315 (Rank & Condition) ---');
  for (let i = 296; i < 316; i++) {
    const val = fields[i];
    if (val && val.trim()) console.log(`  Field ${i}: "${val}"`);
  }

  console.log('\n--- Fields 316-345 (Distance & Surface & Unknown) ---');
  for (let i = 316; i < 346; i++) {
    const val = fields[i];
    if (val && val.trim()) console.log(`  Field ${i}: "${val}"`);
  }

  console.log('\n--- Fields 346-370 (TotalWorks area & beyond) ---');
  for (let i = 346; i < 371; i++) {
    const val = fields[i];
    if (val && val.trim()) console.log(`  Field ${i}: "${val}"`);
  }

  console.log('\n--- Fields 371-400 (Extended area) ---');
  for (let i = 371; i < 401; i++) {
    const val = fields[i];
    if (val && val.trim()) console.log(`  Field ${i}: "${val}"`);
  }

  // Scan ALL fields for time-like values
  console.log('\n--- Scanning ALL fields for time-like values ---');
  fields.forEach((val, idx) => {
    if (!val) return;
    const trimmed = val.trim();
    // Look for time patterns: ":47.20", "47.2", "1:00.4", or numbers 40-130
    if (trimmed.includes(':') ||
        (trimmed.match(/^\d{2}\.\d+$/) && parseFloat(trimmed) >= 40 && parseFloat(trimmed) <= 130)) {
      console.log(`  Field ${idx}: "${trimmed}" (possible time)`);
    }
  });

  // Look for manner/type codes (single letters H, B, D, E, G)
  console.log('\n--- Scanning for workout type codes (H/B/D/E/G) ---');
  fields.forEach((val, idx) => {
    if (!val) return;
    const trimmed = val.trim().toUpperCase();
    if (['H', 'B', 'D', 'E', 'G'].includes(trimmed)) {
      console.log(`  Field ${idx}: "${trimmed}" (possible workout type)`);
    }
  });

  // Look for fields with single letters that might be workout indicators
  console.log('\n--- Scanning fields 276-400 for single-char values ---');
  for (let i = 276; i <= 400; i++) {
    const val = fields[i];
    if (val && val.trim().length === 1) {
      console.log(`  Field ${i}: "${val.trim()}" (single char)`);
    }
  }

  // Extended scan from 400-500
  console.log('\n--- Fields 400-500 (looking for hidden workout data) ---');
  for (let i = 400; i < 500; i++) {
    const val = fields[i];
    if (val && val.trim()) {
      // Print all non-empty fields
      console.log(`  Field ${i}: "${val}"`);
    }
  }

  // Scan for workout times in 1100-1200 range (sometimes stored there)
  console.log('\n--- Fields 1100-1200 (possible workout time area) ---');
  for (let i = 1100; i < 1200; i++) {
    const val = fields[i];
    if (val && val.trim()) {
      const num = parseFloat(val.trim());
      // Workout times are typically 35-75 seconds for 4-6f works
      if (!isNaN(num) && num >= 35 && num <= 130) {
        console.log(`  Field ${i}: "${val}" (likely time)`);
      }
    }
  }

  // Scan for workout times in 1200-1300 range
  console.log('\n--- Fields 1200-1300 (possible workout time area) ---');
  for (let i = 1200; i < 1300; i++) {
    const val = fields[i];
    if (val && val.trim()) {
      const num = parseFloat(val.trim());
      if (!isNaN(num) && num >= 35 && num <= 130) {
        console.log(`  Field ${i}: "${val}" (likely time)`);
      } else if (val.includes(':')) {
        console.log(`  Field ${i}: "${val}" (has colon)`);
      }
    }
  }

  // Scan for workout times in 1300-1400 range
  console.log('\n--- Fields 1300-1400 (possible workout time area) ---');
  for (let i = 1300; i < 1400; i++) {
    const val = fields[i];
    if (val && val.trim()) {
      const num = parseFloat(val.trim());
      if (!isNaN(num) && num >= 35 && num <= 130) {
        console.log(`  Field ${i}: "${val}" (likely time)`);
      } else if (val.includes(':')) {
        console.log(`  Field ${i}: "${val}" (has colon)`);
      } else if (val.trim().length <= 10) {
        // Short values might be meaningful
        console.log(`  Field ${i}: "${val}"`);
      }
    }
  }

  // Print field count summary
  console.log('\n--- FINAL FIELD SUMMARY ---');
  console.log(`  Total fields: ${fields.length}`);
  console.log(`  Fields with time-like data: check 113-120 (PP fractional), 895-914 (PP fractional)`);

  console.log('========== END RAW WORKOUT FIELD DUMP ==========\n');

  // Check the gap at fields 335-344 more carefully
  console.log('\n--- Fields 335-354 (checking for workout times/types) ---');
  for (let i = 335; i <= 354; i++) {
    const val = fields[i];
    console.log(`  Field ${i}: "${val || '(empty)'}"`);
  }

  // Summary of what we found at key indices
  console.log('\n=== KEY FIELD ANALYSIS ===');
  console.log(`Field 316 (current distance field): "${fields[316]}"`);
  console.log(`Field 325 (end of documented workout distance): "${fields[325]}"`);
  console.log(`Field 326 (surface field): "${fields[326]}"`);
  console.log(`Field 345 (end of unknown block): "${fields[345]}"`);
  console.log(`Field 346 (TotalWorks field): "${fields[346]}"`);

  // Look at fields 113-122 closely - these might be workout times
  console.log('\n--- Fields 113-122 (checking if these are workout times) ---');
  for (let i = 113; i <= 122; i++) {
    const val = fields[i];
    console.log(`  Field ${i}: "${val || '(empty)'}"`);
  }

  // WORKOUT DATA STRUCTURE ANALYSIS
  console.log('\n=== WORKOUT FIELD STRUCTURE ANALYSIS ===');
  console.log('Based on dump analysis:');
  console.log('  Fields 255-264: Workout Dates (10 workouts)');
  console.log('  Fields 265-274: Days Since Each Workout (10 values)');
  console.log('  Fields 275-294: Track Codes (20 fields = 2 per workout)');
  console.log('  Fields 295-304: Rank Numbers (10 values)');
  console.log('  Fields 305-314: Track Conditions (10 values)');
  console.log('  Fields 315-324: Distance in YARDS (10 values)');
  console.log('  Fields 325-334: Surface D/T (10 values)');
  console.log('  Fields 335-344: EMPTY (no data found)');
  console.log('  Fields 345-354: Total Works That Day (10 values)');
  console.log('');
  console.log('CONCLUSION: Workout TIME and TYPE are NOT in standard DRF format!');
}
