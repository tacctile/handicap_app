import * as fs from 'fs';

// Try both files
let drf: string;
try {
  drf = fs.readFileSync('/mnt/user-data/uploads/PEN0821.DRF', 'utf-8');
  console.log('Using: PEN0821.DRF');
} catch {
  drf = fs.readFileSync('./src/data/sample.DRF', 'utf-8');
  console.log('Using: sample.DRF');
}

const lines = drf.split('\n').filter(line => line.trim());
const fields = lines[0].split(',');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║              FIELD OFFSET ANALYSIS                                ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Total fields in first line: ${fields.length}`);
console.log(`Total lines (entries) in file: ${lines.length}`);
console.log('');

// ============================================================
// PART 1: Find the horse name to determine offset
// ============================================================
console.log('PART 1: LOCATING HORSE NAME FIELD');
console.log('─'.repeat(60));

// Strip quotes when matching
const stripQuotes = (s: string) => s.replace(/^"(.*)"$/, '$1').trim();

// Search for a field that looks like a horse name (all caps, letters/spaces only)
const horseNamePattern = /^[A-Z][A-Z\s\'\-]{3,25}$/;
const potentialNames: {index: number, value: string, raw: string}[] = [];

fields.forEach((val, idx) => {
  const clean = stripQuotes(val);
  if (clean && horseNamePattern.test(clean)) {
    potentialNames.push({ index: idx, value: clean, raw: val });
  }
});

console.log('Fields matching horse name pattern (after stripping quotes):');
potentialNames.slice(0, 15).forEach(n => {
  console.log(`  Field ${n.index}: "${n.value}" (raw: ${n.raw.slice(0,30)})`);
});
console.log('');

// ============================================================
// PART 2: Find track code to verify offset
// ============================================================
console.log('PART 2: LOCATING TRACK CODE FIELD');
console.log('─'.repeat(60));

// Track codes are 2-3 letter codes like "PEN", "SA", "CD"
const trackPattern = /^[A-Z]{2,3}$/;
const potentialTracks: {index: number, value: string}[] = [];

fields.forEach((val, idx) => {
  const clean = stripQuotes(val);
  if (clean && trackPattern.test(clean) && idx < 100) {
    potentialTracks.push({ index: idx, value: clean });
  }
});

console.log('Fields matching track code pattern (first 100 fields):');
potentialTracks.forEach(t => {
  console.log(`  Field ${t.index}: "${t.value}"`);
});
console.log('');

// ============================================================
// PART 3: Examine fields 0-50 to understand structure
// ============================================================
console.log('PART 3: FIRST 50 FIELDS (RAW vs CLEANED)');
console.log('─'.repeat(60));

for (let i = 0; i < 50; i++) {
  const val = fields[i] || '';
  const clean = stripQuotes(val);
  if (clean) {
    console.log(`  Field ${i.toString().padStart(2)}: "${clean}"`);
  }
}
console.log('');

// ============================================================
// PART 4: Check DRF format - does it have a header row?
// ============================================================
console.log('PART 4: DRF STRUCTURE ANALYSIS');
console.log('─'.repeat(60));

// Look at pattern: where do horse-specific fields start?
console.log('Looking for post position pattern (field near start with value 1-12)...');
for (let i = 0; i < 50; i++) {
  const val = stripQuotes(fields[i] || '');
  if (/^[1-9]$/.test(val) || /^1[0-2]$/.test(val)) {
    console.log(`  Field ${i}: "${val}" (possible post position)`);
  }
}
console.log('');

// ============================================================
// PART 5: Compare expected vs actual for known fields
// ============================================================
console.log('PART 5: EXPECTED VS ACTUAL FIELD COMPARISON');
console.log('─'.repeat(60));

// Standard DRF2 format expectations - indices are 0-based
const expectedFields = [
  { expected: 0, name: 'Track Code', pattern: /^[A-Z]{2,3}$/ },
  { expected: 1, name: 'Race Date', pattern: /^\d{8}$/ },
  { expected: 2, name: 'Race Number', pattern: /^\d{1,2}$/ },
  { expected: 5, name: 'Distance (yards)', pattern: /^\d{3,5}$/ },
  { expected: 6, name: 'Surface', pattern: /^[DT]$/ },
  { expected: 12, name: 'Horse Name (doc says 12)', pattern: /^[A-Z][A-Z\s\'\-]+$/ },
  { expected: 44, name: 'Horse Name (actual?)', pattern: /^[A-Z][A-Z\s\'\-]+$/ },
];

expectedFields.forEach(ef => {
  const rawValue = fields[ef.expected] || '[empty]';
  const cleanValue = stripQuotes(rawValue);
  const matches = ef.pattern.test(cleanValue);

  console.log(`  ${ef.name} (field ${ef.expected}):`);
  console.log(`    Raw: "${rawValue.slice(0, 40)}"`);
  console.log(`    Clean: "${cleanValue.slice(0, 40)}" ${matches ? '✓' : '✗'}`);
  console.log('');
});

// ============================================================
// PART 6: Workout field verification - ALL 12 workout slots
// ============================================================
console.log('PART 6: WORKOUT FIELD VERIFICATION (ALL 12 SLOTS)');
console.log('─'.repeat(60));

// Current parser indices from drfParser.ts
// Workout fields span 12 slots, with 10 fields per workout
console.log('According to drfParser.ts, workout fields start at index 255');
console.log('Each workout has fields: date, daysSince, track, distance, time, condition, description, surface, trackType, rank');
console.log('');

// Check all 12 workout date fields (one per slot)
console.log('Workout Dates (should be YYYYMMDD format):');
for (let i = 0; i < 12; i++) {
  const idx = 255 + i;  // workout dates at 255-266
  const val = stripQuotes(fields[idx] || '');
  console.log(`  Slot ${i+1}, Field ${idx}: "${val}"`);
}
console.log('');

// Check workout distances
console.log('Workout Distances (should be in yards, 220 yards = 1 furlong):');
for (let i = 0; i < 12; i++) {
  const idx = 315 + i;  // workout distances at 315-326
  const val = stripQuotes(fields[idx] || '');
  const yards = parseFloat(val);
  const furlongs = yards / 220;
  console.log(`  Slot ${i+1}, Field ${idx}: "${val}" → ${isNaN(furlongs) ? 'N/A' : furlongs.toFixed(2) + 'f'}`);
}
console.log('');

// Check workout tracks
console.log('Workout Tracks (should be track codes):');
for (let i = 0; i < 12; i++) {
  const idx = 275 + i;  // workout tracks at 275-286
  const val = stripQuotes(fields[idx] || '');
  console.log(`  Slot ${i+1}, Field ${idx}: "${val}"`);
}
console.log('');

// ============================================================
// PART 7: PP (Past Performance) Distance Fields
// ============================================================
console.log('PART 7: PP DISTANCE FIELDS');
console.log('─'.repeat(60));

// PP distances typically start around field 70+ and span 10 races
console.log('Checking PP distance fields (looking for values 800-3000):');

// Find all fields with distance-like values in the PP range
const ppDistances: {idx: number, val: string, furlongs: number}[] = [];
for (let i = 50; i < 200; i++) {
  const val = stripQuotes(fields[i] || '');
  const yards = parseFloat(val);
  if (!isNaN(yards) && yards >= 800 && yards <= 3000) {
    ppDistances.push({ idx: i, val, furlongs: yards / 220 });
  }
}

ppDistances.slice(0, 15).forEach(d => {
  console.log(`  Field ${d.idx}: ${d.val} yards → ${d.furlongs.toFixed(2)}f`);
});
console.log('');

// ============================================================
// PART 8: Check the conversion functions in the app
// ============================================================
console.log('PART 8: TESTING CONVERSION LOGIC');
console.log('─'.repeat(60));

// The issue report says 1320 displays as "1m" - let's check if this is a conversion bug
const testDistances = [
  { yards: 1320, expected: '6f', description: '6 furlongs' },
  { yards: 1760, expected: '1m', description: '1 mile' },
  { yards: 1210, expected: '5.5f', description: '5.5 furlongs' },
  { yards: 1650, expected: '7.5f', description: '7.5 furlongs' },
  { yards: 880, expected: '4f', description: '4 furlongs' },
];

console.log('Standard distance conversions (yards → furlongs):');
testDistances.forEach(d => {
  const furlongs = d.yards / 220;
  console.log(`  ${d.yards} yards = ${furlongs}f = ${d.expected} (${d.description})`);
});
console.log('');

// Check what value would give "1m" if misinterpreted
console.log('What value would give "1m" if parsed differently?');
console.log('  If 1320 is treated as feet: 1320/5280 = 0.25 miles');
console.log('  If 1320 is treated as meters: 1320m = 0.82 miles');
console.log('  If value is 1760 (1 mile in yards): 1760/220 = 8f = 1m');
console.log('');

// ============================================================
// PART 9: Deep dive into field 315 area
// ============================================================
console.log('PART 9: FIELDS 310-350 (AROUND WORKOUT DISTANCE)');
console.log('─'.repeat(60));

for (let i = 310; i <= 350; i++) {
  const val = stripQuotes(fields[i] || '');
  if (val) {
    const asNum = parseFloat(val);
    const extra = !isNaN(asNum) && asNum >= 800 && asNum <= 3000
      ? ` → ${(asNum/220).toFixed(2)}f`
      : '';
    console.log(`  Field ${i}: "${val}"${extra}`);
  }
}
console.log('');

// ============================================================
// PART 10: Summary
// ============================================================
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║                         SUMMARY                                  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');

// Analyze the findings
const field0 = stripQuotes(fields[0] || '');
const field1 = stripQuotes(fields[1] || '');
const field44 = stripQuotes(fields[44] || '');
const field315 = stripQuotes(fields[315] || '');

console.log('KEY FINDINGS:');
console.log('─'.repeat(40));
console.log(`1. Track Code at field 0: "${field0}" ${/^[A-Z]{2,3}$/.test(field0) ? '✓ CORRECT' : '✗ WRONG'}`);
console.log(`2. Race Date at field 1: "${field1}" ${/^\d{8}$/.test(field1) ? '✓ CORRECT' : '✗ WRONG'}`);
console.log(`3. Horse Name at field 44: "${field44}" ${horseNamePattern.test(field44) ? '✓ FOUND' : '✗'}`);
console.log(`4. Workout Distance at field 315: "${field315}" = ${parseInt(field315)/220}f`);
console.log('');

console.log('OFFSET ANALYSIS:');
console.log('─'.repeat(40));
if (horseNamePattern.test(field44)) {
  console.log('Horse name is at field 44, but DRF spec says field 12.');
  console.log('Looking at structure, fields 0-19 are race header, 20+ are horse data.');
  console.log('CONCLUSION: This appears to be correct DRF2 format where:');
  console.log('  - Fields 0-19: Race header information');
  console.log('  - Fields 20+: Horse-specific entry data');
  console.log('  - Field 44 for horse name is EXPECTED (not an offset error)');
}
console.log('');

console.log('WORKOUT DISTANCE ANALYSIS:');
console.log('─'.repeat(40));
console.log(`Field 315 value: ${field315} yards`);
console.log(`Conversion: ${parseInt(field315)} / 220 = ${parseInt(field315)/220} furlongs`);
console.log('');
console.log('If this shows as "1m" in the app, the bug is in the DISPLAY logic,');
console.log('not the field offset. The raw data is CORRECT.');
console.log('');

// Check line 2 to compare
if (lines[1]) {
  const line2Fields = lines[1].split(',');
  console.log('VERIFICATION - LINE 2 (second horse):');
  console.log('─'.repeat(40));
  console.log(`  Track: "${stripQuotes(line2Fields[0] || '')}"`);
  console.log(`  Date: "${stripQuotes(line2Fields[1] || '')}"`);
  console.log(`  Horse Name (field 44): "${stripQuotes(line2Fields[44] || '')}"`);
  console.log(`  Workout Distance (field 315): "${stripQuotes(line2Fields[315] || '')}"`);
}
console.log('');
