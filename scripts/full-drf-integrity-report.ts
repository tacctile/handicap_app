import * as fs from 'fs';

// Read the actual DRF file
const drfPath = '/home/user/handicap_app/src/data/sample.DRF';
const drf = fs.readFileSync(drfPath, 'utf-8');
const lines = drf.split('\n').filter(line => line.trim());

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║           COMPLETE DRF DATA INTEGRITY REPORT                     ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('File:', drfPath);
console.log('Total horse entries:', lines.length);
console.log('Generated:', new Date().toISOString());
console.log('');

// Use first horse for detailed analysis
const firstLine = lines[0];
const fields = firstLine.split(',');

console.log('Total fields per entry:', fields.length);
console.log('');

// ============================================================
// SECTION 1: RACE/TRACK INFORMATION (Fields 1-50)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 1: RACE/TRACK INFORMATION                                │');
console.log('└──────────────────────────────────────────────────────────────────┘');

const raceFields = [
  { index: 0, name: 'Track Code' },
  { index: 1, name: 'Race Date' },
  { index: 2, name: 'Race Number' },
  { index: 3, name: 'Post Position' },
  { index: 4, name: 'Entry Indicator' },
  { index: 5, name: 'Distance (yards)' },
  { index: 6, name: 'Surface' },
  { index: 7, name: 'Race Type' },
  { index: 8, name: 'Age/Sex Restrictions' },
  { index: 9, name: 'Purse' },
  { index: 10, name: 'Claiming Price' },
  { index: 11, name: 'Track Condition' },
];

raceFields.forEach(f => {
  console.log(`  Field ${f.index.toString().padStart(3)}: ${f.name.padEnd(25)} = "${fields[f.index] || ''}"`)
});
console.log('');

// ============================================================
// SECTION 2: HORSE IDENTIFICATION (Fields 12-50)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 2: HORSE IDENTIFICATION                                  │');
console.log('└──────────────────────────────────────────────────────────────────┘');

const horseFields = [
  { index: 12, name: 'Horse Name' },
  { index: 13, name: 'Year of Birth' },
  { index: 14, name: 'Foaling Month' },
  { index: 15, name: 'Sex' },
  { index: 16, name: 'Color' },
  { index: 17, name: 'Sire' },
  { index: 18, name: 'Sire of Sire' },
  { index: 19, name: 'Dam' },
  { index: 20, name: 'Dam Sire' },
  { index: 21, name: 'Breeder' },
  { index: 22, name: 'State/Country Bred' },
  { index: 23, name: 'Owner' },
  { index: 24, name: 'Owner Silks' },
  { index: 25, name: 'Trainer Name' },
  { index: 26, name: 'Trainer Starts' },
  { index: 27, name: 'Trainer Wins' },
  { index: 28, name: 'Jockey Name' },
  { index: 29, name: 'Jockey Starts' },
  { index: 30, name: 'Jockey Wins' },
];

horseFields.forEach(f => {
  console.log(`  Field ${f.index.toString().padStart(3)}: ${f.name.padEnd(25)} = "${fields[f.index] || ''}"`)
});
console.log('');

// ============================================================
// SECTION 3: LIFETIME/YEARLY STATISTICS (Fields 51-100)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 3: LIFETIME/YEARLY STATISTICS                            │');
console.log('└──────────────────────────────────────────────────────────────────┘');

const statsFields = [
  { index: 31, name: 'Morning Line Odds' },
  { index: 32, name: 'Weight' },
  { index: 33, name: 'Apprentice Allowance' },
  { index: 34, name: 'Medication' },
  { index: 35, name: 'Equipment' },
  { index: 36, name: 'Lifetime Starts' },
  { index: 37, name: 'Lifetime Wins' },
  { index: 38, name: 'Lifetime Places' },
  { index: 39, name: 'Lifetime Shows' },
  { index: 40, name: 'Lifetime Earnings' },
  { index: 41, name: 'Current Year Starts' },
  { index: 42, name: 'Current Year Wins' },
  { index: 43, name: 'Current Year Places' },
  { index: 44, name: 'Current Year Shows' },
  { index: 45, name: 'Current Year Earnings' },
  { index: 46, name: 'Previous Year Starts' },
  { index: 47, name: 'Previous Year Wins' },
  { index: 48, name: 'Previous Year Places' },
  { index: 49, name: 'Previous Year Shows' },
  { index: 50, name: 'Previous Year Earnings' },
];

statsFields.forEach(f => {
  console.log(`  Field ${f.index.toString().padStart(3)}: ${f.name.padEnd(25)} = "${fields[f.index] || ''}"`)
});
console.log('');

// ============================================================
// SECTION 4: SURFACE/DISTANCE STATISTICS
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 4: SURFACE/DISTANCE STATISTICS                           │');
console.log('└──────────────────────────────────────────────────────────────────┘');

const surfaceFields = [
  { index: 51, name: 'Turf Starts' },
  { index: 52, name: 'Turf Wins' },
  { index: 53, name: 'Turf Places' },
  { index: 54, name: 'Turf Shows' },
  { index: 55, name: 'Turf Earnings' },
  { index: 56, name: 'Wet Track Starts' },
  { index: 57, name: 'Wet Track Wins' },
  { index: 58, name: 'Wet Track Places' },
  { index: 59, name: 'Wet Track Shows' },
  { index: 60, name: 'Wet Track Earnings' },
  { index: 61, name: 'Distance Starts' },
  { index: 62, name: 'Distance Wins' },
  { index: 63, name: 'Distance Places' },
  { index: 64, name: 'Distance Shows' },
  { index: 65, name: 'Distance Earnings' },
  { index: 66, name: 'Track Starts' },
  { index: 67, name: 'Track Wins' },
  { index: 68, name: 'Track Places' },
  { index: 69, name: 'Track Shows' },
  { index: 70, name: 'Track Earnings' },
];

surfaceFields.forEach(f => {
  console.log(`  Field ${f.index.toString().padStart(3)}: ${f.name.padEnd(25)} = "${fields[f.index] || ''}"`)
});
console.log('');

// ============================================================
// SECTION 5: PAST PERFORMANCE 1 (Most Recent Race)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 5: PAST PERFORMANCE #1 (Most Recent)                     │');
console.log('└──────────────────────────────────────────────────────────────────┘');

// PP fields typically start around index 71-100 and repeat for each race
// This is approximate - adjust based on actual DRF format
const ppStartIndex = 71;
const ppFieldsPerRace = 40; // Approximate

const pp1Fields = [
  { offset: 0, name: 'PP1 Date' },
  { offset: 1, name: 'PP1 Track' },
  { offset: 2, name: 'PP1 Race Number' },
  { offset: 3, name: 'PP1 Surface' },
  { offset: 4, name: 'PP1 Distance' },
  { offset: 5, name: 'PP1 Track Condition' },
  { offset: 6, name: 'PP1 Purse' },
  { offset: 7, name: 'PP1 Race Type' },
  { offset: 8, name: 'PP1 Field Size' },
  { offset: 9, name: 'PP1 Post Position' },
  { offset: 10, name: 'PP1 Start Position' },
  { offset: 11, name: 'PP1 First Call Pos' },
  { offset: 12, name: 'PP1 Second Call Pos' },
  { offset: 13, name: 'PP1 Third Call Pos' },
  { offset: 14, name: 'PP1 Stretch Pos' },
  { offset: 15, name: 'PP1 Finish Pos' },
  { offset: 16, name: 'PP1 Lengths Behind' },
  { offset: 17, name: 'PP1 Odds' },
  { offset: 18, name: 'PP1 Speed Figure' },
  { offset: 19, name: 'PP1 Jockey' },
  { offset: 20, name: 'PP1 Weight' },
  { offset: 21, name: 'PP1 Comment' },
  { offset: 22, name: 'PP1 Winner' },
  { offset: 23, name: 'PP1 Second Place' },
  { offset: 24, name: 'PP1 Third Place' },
];

pp1Fields.forEach(f => {
  const idx = ppStartIndex + f.offset;
  console.log(`  Field ${idx.toString().padStart(3)}: ${f.name.padEnd(25)} = "${fields[idx] || ''}"`)
});
console.log('');

// ============================================================
// SECTION 6: WORKOUTS (Fields 255-355)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 6: WORKOUTS (All 10)                                     │');
console.log('└──────────────────────────────────────────────────────────────────┘');

// Current parser field indices
const WK_DATE = 255;
const WK_DAYS_SINCE = 265;
const WK_TRACK = 275;
const WK_RANK = 295;
const WK_CONDITION = 305;
const WK_DISTANCE = 315;
const WK_SURFACE = 325;
const WK_TOTAL_WORKS = 345;

for (let i = 0; i < 10; i++) {
  const date = fields[WK_DATE + i] || '';
  if (!date) continue; // Skip empty workouts

  console.log(`  --- Workout ${i + 1} ---`);
  console.log(`    Date (${WK_DATE + i}):        "${date}"`);
  console.log(`    Days Since (${WK_DAYS_SINCE + i}):  "${fields[WK_DAYS_SINCE + i] || ''}"`);
  console.log(`    Track (${WK_TRACK + i}):       "${fields[WK_TRACK + i] || ''}"`);
  console.log(`    Track (${WK_TRACK + i + 10}):     "${fields[WK_TRACK + i + 10] || ''}" (secondary)`);
  console.log(`    Rank (${WK_RANK + i}):        "${fields[WK_RANK + i] || ''}"`);
  console.log(`    Condition (${WK_CONDITION + i}): "${fields[WK_CONDITION + i] || ''}"`);
  console.log(`    Distance (${WK_DISTANCE + i}):  "${fields[WK_DISTANCE + i] || ''}"`);
  console.log(`    Surface (${WK_SURFACE + i}):   "${fields[WK_SURFACE + i] || ''}"`);
  console.log(`    Total Works (${WK_TOTAL_WORKS + i}): "${fields[WK_TOTAL_WORKS + i] || ''}"`);

  // Calculate possible distance interpretations
  const rawDist = parseFloat(fields[WK_DISTANCE + i]) || 0;
  if (rawDist > 0) {
    console.log(`    --- Distance Analysis ---`);
    console.log(`    Raw value: ${rawDist}`);
    console.log(`    If YARDS (÷220):    ${(rawDist / 220).toFixed(2)} furlongs`);
    console.log(`    If FEET (÷660):     ${(rawDist / 660).toFixed(2)} furlongs`);
    console.log(`    If already FURLONGS: ${rawDist} furlongs`);
    console.log(`    If EIGHTHS (×0.125): ${(rawDist * 0.125).toFixed(2)} miles = ${(rawDist)} furlongs`);
  }
  console.log('');
}

// ============================================================
// SECTION 7: RAW FIELD DUMP (250-400)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 7: RAW FIELD DUMP (Fields 250-400)                       │');
console.log('│ Shows all non-empty fields in the workout/extended range         │');
console.log('└──────────────────────────────────────────────────────────────────┘');

for (let i = 250; i < Math.min(400, fields.length); i++) {
  const val = fields[i];
  if (val && val.trim()) {
    console.log(`  Field ${i.toString().padStart(3)}: "${val}"`);
  }
}
console.log('');

// ============================================================
// SECTION 8: FIELD COUNT SUMMARY
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 8: FIELD COUNT SUMMARY                                   │');
console.log('└──────────────────────────────────────────────────────────────────┘');

let nonEmptyCount = 0;
let emptyCount = 0;
fields.forEach((f, i) => {
  if (f && f.trim()) nonEmptyCount++;
  else emptyCount++;
});

console.log(`  Total fields: ${fields.length}`);
console.log(`  Non-empty fields: ${nonEmptyCount}`);
console.log(`  Empty fields: ${emptyCount}`);
console.log('');

// ============================================================
// SECTION 9: SEARCH FOR TIME-LIKE VALUES
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 9: SEARCH FOR WORKOUT TIME/TYPE VALUES                   │');
console.log('└──────────────────────────────────────────────────────────────────┘');

console.log('  Searching for time-like values (XX.XX format, 30-180 range)...');
fields.forEach((val, idx) => {
  if (!val) return;
  const num = parseFloat(val);
  // Workout times are typically 30-180 seconds
  if (!isNaN(num) && num >= 30 && num <= 180 && val.includes('.')) {
    console.log(`    Field ${idx}: "${val}" (possible time: ${Math.floor(num/60)}:${(num%60).toFixed(2).padStart(5,'0')})`);
  }
});
console.log('');

console.log('  Searching for type codes (H, B, D, E, G single letters)...');
fields.forEach((val, idx) => {
  if (!val) return;
  const trimmed = val.trim().toUpperCase();
  if (trimmed.length === 1 && ['H', 'B', 'D', 'E', 'G'].includes(trimmed)) {
    console.log(`    Field ${idx}: "${trimmed}" (possible workout type)`);
  }
});
console.log('');

// ============================================================
// SECTION 10: ALL HORSES SUMMARY
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 10: ALL HORSES IN FILE                                   │');
console.log('└──────────────────────────────────────────────────────────────────┘');

lines.forEach((line, idx) => {
  const f = line.split(',');
  const horseName = f[12] || 'Unknown';
  const raceNum = f[2] || '?';
  const workoutCount = [255,256,257,258,259,260,261,262,263,264].filter(i => f[i] && f[i].trim()).length;
  console.log(`  ${(idx + 1).toString().padStart(2)}. Race ${raceNum}: ${horseName.padEnd(25)} (${workoutCount} workouts)`);
});

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║                    END OF INTEGRITY REPORT                       ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
