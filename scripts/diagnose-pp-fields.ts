import * as fs from 'fs';

// Import the parser if possible, or read raw data
let drf: string;
try {
  drf = fs.readFileSync('/mnt/user-data/uploads/PEN0821.DRF', 'utf-8');
  console.log('Using: PEN0821.DRF');
} catch {
  try {
    drf = fs.readFileSync('./src/data/sample.DRF', 'utf-8');
    console.log('Using: sample.DRF');
  } catch {
    console.log('No DRF file found');
    process.exit(1);
  }
}

const lines = drf.split('\n').filter((line) => line.trim());
const fields = lines[0].split(',');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║        PP (PAST PERFORMANCE) FIELD DIAGNOSTIC                    ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Total fields in DRF:', fields.length);
console.log('Total horses (lines):', lines.length);
console.log('');

// ============================================================
// PART 1: Read the PastPerformance type definition
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 1: PASTPERFORMANCE TYPE DEFINITION                          │');
console.log('│ (Read from src/types/drf.ts)                                     │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

try {
  const typesFile = fs.readFileSync('./src/types/drf.ts', 'utf-8');

  // Find PastPerformance interface
  const ppMatch = typesFile.match(/interface PastPerformance \{[\s\S]*?\n\}/);
  if (ppMatch) {
    console.log('PastPerformance interface:');
    console.log(ppMatch[0]);
  } else {
    console.log('Could not find PastPerformance interface');
  }
} catch (e) {
  console.log('Could not read types file:', e);
}
console.log('');

// ============================================================
// PART 2: Check parser for PP field indices
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 2: PP FIELD INDICES FROM PARSER                             │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

try {
  const parserFile = fs.readFileSync('./src/lib/drfParser.ts', 'utf-8');

  // Look for PP-related constants
  const ppConstants = parserFile.match(/PP_\w+\s*=\s*\d+/g);
  if (ppConstants) {
    console.log('PP field constants found in parser:');
    ppConstants.forEach((c) => console.log('  ' + c));
  }
} catch (e) {
  console.log('Could not read parser file:', e);
}
console.log('');

// ============================================================
// PART 3: Examine DRF Field Map for PP-related fields
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 3: KEY PP FIELD RANGES FROM DRF_FIELD_MAP.md                │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');
console.log('Per DRF_FIELD_MAP.md specification:');
console.log('');
console.log('  PP Dates:              Fields 102-113 (index 101-112)');
console.log('  PP Distances:          Fields 114-125 (index 113-124)');
console.log('  PP Track Codes:        Fields 126-137 (index 125-136)');
console.log('  PP Track Conditions:   Fields 150-161 (index 149-160)');
console.log('  PP Equipment:          Fields 162-173 (index 161-172) ← TARGET');
console.log('  PP Medication:         Fields 174-185 (index 173-184) ← TARGET');
console.log('  PP Field Size:         Fields 186-197 (index 185-196)');
console.log('  PP Finish Position:    Fields 356-365 (index 355-364)');
console.log('  PP Finish Margin:      Fields 366-375 (index 365-374)');
console.log('  PP Final Odds:         Fields 516-525 (index 515-524)');
console.log('  PP Beyer Figures:      Fields 766-775 (index 765-774)');
console.log('  PP Quarter Times:      Fields 866-875 (index 865-874)');
console.log('  PP Half-Mile Times:    Fields 896-905 (index 895-904)');
console.log('  PP 6F Times:           Fields 906-915 (index 905-914)');
console.log('  PP Mile Times:         Fields 916-925 (index 915-924)');
console.log('  PP Final Times:        Fields 1006-1015 (index 1005-1014) ← TARGET');
console.log('');

// ============================================================
// PART 4: Examine actual field values for target fields
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 4: ACTUAL FIELD VALUES FOR TARGET PP FIELDS                 │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

// Field indices (0-based) - documented for reference
const _PP_DATE_START = 101;
const _PP_EQUIPMENT_START = 161;
const _PP_MEDICATION_START = 173;
const _PP_FINAL_TIME_START = 1005; // Per doc: Fields 1006-1015

// Also check other potential final time locations - documented for reference
const _PP_QUARTER_TIME = 865;
const _PP_HALF_TIME = 895;
const _PP_6F_TIME = 905;
const _PP_MILE_TIME = 915;

console.log("Examining first horse's PP data:");
console.log('');

// PP1 Values
console.log('=== PP1 (Most Recent Race) ===');
console.log(`  Date (field 102, idx 101):       "${fields[101]}"`);
console.log(`  Equipment (field 162, idx 161):  "${fields[161]}"`);
console.log(`  Medication (field 174, idx 173): "${fields[173]}"`);
console.log('');

// Check final time fields
console.log('=== Fractional/Final Time Fields ===');
console.log(`  Quarter Time (field 866, idx 865):    "${fields[865]}"`);
console.log(`  Half Time (field 896, idx 895):       "${fields[895]}"`);
console.log(`  6F Time (field 906, idx 905):         "${fields[905]}"`);
console.log(`  Mile Time (field 916, idx 915):       "${fields[915]}"`);
console.log(`  Final Time (field 1006, idx 1005):    "${fields[1005]}"`);
console.log('');

// PP2-PP3 for pattern confirmation
console.log('=== PP2 and PP3 Values ===');
console.log(`  PP2 Date (field 103, idx 102):       "${fields[102]}"`);
console.log(`  PP2 Equipment (field 163, idx 162):  "${fields[162]}"`);
console.log(`  PP2 Medication (field 175, idx 174): "${fields[174]}"`);
console.log(`  PP2 Final Time (field 1007, idx 1006): "${fields[1006]}"`);
console.log('');
console.log(`  PP3 Date (field 104, idx 103):       "${fields[103]}"`);
console.log(`  PP3 Equipment (field 164, idx 163):  "${fields[163]}"`);
console.log(`  PP3 Medication (field 176, idx 175): "${fields[175]}"`);
console.log(`  PP3 Final Time (field 1008, idx 1007): "${fields[1007]}"`);
console.log('');

// ============================================================
// PART 5: Search for time-like values (format: seconds with decimals)
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 5: SEARCHING FOR FINAL TIME VALUES                          │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('Looking for time values (60-150 seconds range with decimals):');
const timeFields: { index: number; value: string; formatted: string }[] = [];
fields.forEach((val, idx) => {
  const num = parseFloat(val);
  // Race times are typically 60-180 seconds (1:00 to 3:00)
  if (!isNaN(num) && num >= 60 && num <= 180 && val.includes('.')) {
    const mins = Math.floor(num / 60);
    const secs = (num % 60).toFixed(2);
    timeFields.push({
      index: idx,
      value: val,
      formatted: `${mins}:${secs.padStart(5, '0')}`,
    });
  }
});

if (timeFields.length > 0) {
  console.log('Potential final time fields found:');
  timeFields.slice(0, 30).forEach((t) => {
    console.log(`  Field ${t.index + 1} (idx ${t.index}): "${t.value}" → ${t.formatted}`);
  });
} else {
  console.log('No obvious final time values found in expected range.');
  console.log('Checking alternative time formats...');

  // Check for times stored as fifths of a second (e.g., 1:10.20 = 7020 fifths)
  // Or times stored without decimal (e.g., 11020 = 1:10.20)
  console.log('');
  console.log('Checking fields around expected final time location (idx 1005-1015):');
  for (let i = 1000; i < 1020 && i < fields.length; i++) {
    console.log(`  Field ${i + 1} (idx ${i}): "${fields[i]}"`);
  }
}
console.log('');

// ============================================================
// PART 6: Check what PPLine component currently uses
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 6: CURRENT PPLINE COMPONENT FIELDS                          │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

try {
  const ppLineFile = fs.readFileSync('./src/components/PPLine.tsx', 'utf-8');

  // Find all pp.* references
  const ppRefs = ppLineFile.match(/pp\.\w+/g);
  if (ppRefs) {
    const uniqueRefs = [...new Set(ppRefs)].sort();
    console.log('Fields currently accessed in PPLine.tsx:');
    uniqueRefs.forEach((ref) => console.log('  ' + ref));
  }
} catch (e) {
  console.log('Could not read PPLine.tsx:', e);
}
console.log('');

// ============================================================
// PART 7: Verify equipment/medication are being parsed
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 7: EQUIPMENT & MEDICATION PARSING VERIFICATION              │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('Equipment values from all horses (first 10 PP1s):');
for (let h = 0; h < Math.min(10, lines.length); h++) {
  const horseFields = lines[h].split(',');
  const equip = horseFields[161] || '(empty)';
  const med = horseFields[173] || '(empty)';
  const track = horseFields[125] || '?';
  console.log(`  Horse ${h + 1}: Track=${track}, Equipment="${equip}", Medication="${med}"`);
}
console.log('');

// ============================================================
// PART 8: Calculate days-since from PP dates
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 8: DAYS SINCE LAST RACE (CALCULATED FROM DATES)             │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('PP Dates for first horse:');
const dates: string[] = [];
for (let i = 0; i < 10; i++) {
  const date = fields[101 + i];
  if (date && date.trim()) {
    dates.push(date);
    console.log(`  PP${i + 1} Date: ${date}`);
  }
}

if (dates.length >= 2) {
  console.log('');
  console.log('Days between races (calculated):');
  for (let i = 0; i < dates.length - 1; i++) {
    const d1 = dates[i];
    const d2 = dates[i + 1];
    if (d1 && d2 && d1.length === 8 && d2.length === 8) {
      const date1 = new Date(
        parseInt(d1.slice(0, 4)),
        parseInt(d1.slice(4, 6)) - 1,
        parseInt(d1.slice(6, 8))
      );
      const date2 = new Date(
        parseInt(d2.slice(0, 4)),
        parseInt(d2.slice(4, 6)) - 1,
        parseInt(d2.slice(6, 8))
      );
      const daysDiff = Math.round((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  PP${i + 1} → PP${i + 2}: ${daysDiff} days`);
    }
  }
}
console.log('');

// ============================================================
// PART 9: Summary of available but unused fields
// ============================================================
console.log('┌──────────────────────────────────────────────────────────────────┐');
console.log('│ PART 9: SUMMARY - FIELDS AVAILABLE TO ADD                        │');
console.log('└──────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('1. FINAL TIME');
console.log('   Status: TYPE EXISTS (pp.finalTime, pp.finalTimeFormatted)');
console.log('   Parser: Sets to null - comment says "In extended fractional data"');
console.log('   DRF Fields: 1006-1015 (index 1005-1014)');
console.log('   Sample value (idx 1005): "' + (fields[1005] || 'empty') + '"');
console.log('   Action: Need to parse from fractional time fields');
console.log('');

console.log('2. DAYS SINCE LAST RACE');
console.log('   Status: TYPE EXISTS (pp.daysSinceLast)');
console.log('   Parser: Sets to null - comment says "Calculated from dates"');
console.log('   Source: Calculate from PP dates (fields 102-113)');
console.log('   Action: Add calculation in parser');
console.log('');

console.log('3. EQUIPMENT PER PP');
console.log('   Status: TYPE EXISTS (pp.equipment: string)');
console.log('   Parser: ALREADY PARSED from fields 162-173');
console.log('   Sample PP1 value: "' + (fields[161] || 'empty') + '"');
console.log('   Action: Just needs to be displayed in PPLine.tsx');
console.log('');

console.log('4. MEDICATION PER PP');
console.log('   Status: TYPE EXISTS (pp.medication: string)');
console.log('   Parser: ALREADY PARSED from fields 174-185');
console.log('   Sample PP1 value: "' + (fields[173] || 'empty') + '"');
console.log('   Action: Just needs to be displayed in PPLine.tsx');
console.log('');

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║                    END OF DIAGNOSTIC                             ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
