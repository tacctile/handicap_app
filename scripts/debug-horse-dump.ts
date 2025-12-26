import * as fs from 'fs';

/**
 * Complete Debug Dump for a specific horse from DRF file
 * Shows EVERY field with raw index, raw value, and parsed interpretation
 */

const HORSE_NAME = 'GLOWS IN THE DARK';
const DRF_FILE = './src/data/PEN0821.DRF';

// Read the DRF file
let drf: string;
try {
  drf = fs.readFileSync(DRF_FILE, 'utf-8');
} catch {
  console.error(`Could not read ${DRF_FILE}`);
  process.exit(1);
}

const lines = drf.split('\n').filter(line => line.trim());

// Find the horse
let horseFields: string[] | null = null;
let lineNumber = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line && line.includes(HORSE_NAME)) {
    // Parse CSV properly handling quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
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

    if (fields[44] === HORSE_NAME) {
      horseFields = fields;
      lineNumber = i + 1;
      break;
    }
  }
}

if (!horseFields) {
  console.error(`Horse "${HORSE_NAME}" not found in ${DRF_FILE}`);
  process.exit(1);
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log(`║  COMPLETE DEBUG DUMP: ${HORSE_NAME.padEnd(54)}║`);
console.log(`║  File: ${DRF_FILE.padEnd(69)}║`);
console.log(`║  Line: ${String(lineNumber).padEnd(69)}║`);
console.log(`║  Total Fields: ${String(horseFields.length).padEnd(61)}║`);
console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
console.log('');

// Helper function to format output
function printField(fieldNum: number, name: string, rawValue: string, parsed?: string) {
  const idx = fieldNum - 1;
  const raw = rawValue || '(empty)';
  const parsedStr = parsed !== undefined ? parsed : raw;
  console.log(`${String(fieldNum).padStart(4)} | ${String(idx).padStart(4)} | ${raw.substring(0, 30).padEnd(30)} | ${name}: ${parsedStr}`);
}

function getField(idx: number): string {
  return horseFields![idx]?.trim() || '';
}

// ============================================================================
// SECTION 1: RACE HEADER (Fields 1-27)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 1: RACE HEADER INFORMATION (Fields 1-27)                              │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');
console.log('│Field │ Idx  │ Raw Value                      │ Interpretation                  │');
console.log('├──────┼──────┼────────────────────────────────┼─────────────────────────────────┤');

printField(1, 'Track Code', getField(0));
printField(2, 'Race Date', getField(1));
printField(3, 'Race Number', getField(2));
printField(4, 'Post Position', getField(3));
printField(5, 'Reserved/Entry', getField(4));
printField(6, 'Post Time (yards)', getField(5));
printField(7, 'Surface Code', getField(6), getField(6) === 'D' ? 'Dirt' : getField(6) === 'T' ? 'Turf' : getField(6));
printField(8, 'Reserved', getField(7));
printField(9, 'Distance Code', getField(8), getField(8) === 'S' ? 'Sprint' : 'Route');
printField(10, 'Race Type', getField(9));
printField(11, 'Race Conditions', getField(10));
printField(12, 'Purse', getField(11), `$${parseInt(getField(11) || '0').toLocaleString()}`);
printField(13, 'Reserved', getField(12));
printField(14, 'Reserved', getField(13));
printField(15, 'Distance (furlongs)', getField(14), `${parseFloat(getField(14) || '0') / 8} furlongs (if in 8ths)`);
printField(16, 'Race Description', getField(15));
printField(17, 'Top Picks', getField(16));
for (let i = 17; i <= 20; i++) printField(i + 1, `Reserved ${i + 1}`, getField(i));
printField(21, 'Track Code 2', getField(20));
printField(22, 'Race Number 2', getField(21));
printField(23, 'Breed Code', getField(22));
printField(24, 'Field Size', getField(23));
for (let i = 24; i <= 26; i++) printField(i + 1, `Reserved ${i + 1}`, getField(i));

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 2: HORSE IDENTITY & CONNECTIONS (Fields 28-57)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 2: HORSE IDENTITY & CONNECTIONS (Fields 28-57)                        │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

// Trainer (28-32)
printField(28, 'Trainer Name', getField(27));
printField(29, 'Trainer Starts (meet)', getField(28));
printField(30, 'Trainer Wins (meet)', getField(29));
printField(31, 'Trainer Places (meet)', getField(30));
printField(32, 'Trainer Shows (meet)', getField(31));

// Jockey (33-38)
printField(33, 'Jockey Name', getField(32));
printField(34, 'Jockey Reserved', getField(33));
printField(35, 'Jockey Starts (meet)', getField(34));
printField(36, 'Jockey Wins (meet)', getField(35));
printField(37, 'Jockey Places (meet)', getField(36));
printField(38, 'Jockey Shows (meet)', getField(37));

// Owner (39-42)
printField(39, 'Owner Name', getField(38));
printField(40, 'Silks Description', getField(39));
printField(41, 'Reserved', getField(40));
printField(42, 'Reserved', getField(41));

// Horse ID (43-51)
printField(43, 'Program Number', getField(42));
printField(44, 'Morning Line Odds', getField(43));
printField(45, 'HORSE NAME', getField(44));
printField(46, 'Age (years)', getField(45));
printField(47, 'Age (months)', getField(46));
printField(48, 'Reserved', getField(47));
printField(49, 'Sex Code', getField(48), getField(48) === 'F' ? 'Filly' : getField(48) === 'C' ? 'Colt' : getField(48) === 'G' ? 'Gelding' : getField(48));
printField(50, 'Color', getField(49));
printField(51, 'Weight', getField(50));

// Breeding (52-57)
printField(52, 'Sire', getField(51));
printField(53, "Sire's Sire", getField(52));
printField(54, 'Dam', getField(53));
printField(55, "Dam's Sire", getField(54));
printField(56, 'Breeder', getField(55));
printField(57, 'Where Bred', getField(56));

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 3: LIFETIME RECORDS (Fields 62-101)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 3: LIFETIME PERFORMANCE RECORDS (Fields 62-101)                       │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

// Fields 58-61 reserved
for (let i = 57; i <= 60; i++) printField(i + 1, `Reserved ${i + 1}`, getField(i));

// Lifetime (62-69)
printField(62, 'Lifetime Starts', getField(61));
printField(63, 'Lifetime Wins', getField(62));
printField(64, 'Lifetime Places', getField(63));
printField(65, 'Lifetime Shows', getField(64));
printField(66, 'Reserved', getField(65));
printField(67, 'Reserved', getField(66));
printField(68, 'Reserved', getField(67));
printField(69, 'Lifetime Earnings', getField(68));

// Current Year (70-74)
printField(70, 'Current Year Starts', getField(69));
printField(71, 'Current Year Wins', getField(70));
printField(72, 'Current Year Places', getField(71));
printField(73, 'Current Year Shows', getField(72));
printField(74, 'Current Year Earnings', getField(73));

// Previous Year (75-79)
printField(75, 'Previous Year Starts', getField(74));
printField(76, 'Previous Year Wins', getField(75));
printField(77, 'Previous Year Places', getField(76));
printField(78, 'Previous Year Shows', getField(77));
printField(79, 'Previous Year Earnings', getField(78));

// Track Record (80-84)
printField(80, 'Track Starts', getField(79));
printField(81, 'Track Wins', getField(80));
printField(82, 'Track Places', getField(81));
printField(83, 'Track Shows', getField(82));
printField(84, 'Track Earnings', getField(83));

// Turf Record (85-88)
printField(85, 'Turf Starts', getField(84));
printField(86, 'Turf Wins', getField(85));
printField(87, 'Turf Places', getField(86));
printField(88, 'Turf Shows', getField(87));

// Wet Track Record (89-92)
printField(89, 'Wet Track Starts', getField(88));
printField(90, 'Wet Track Wins', getField(89));
printField(91, 'Wet Track Places', getField(90));
printField(92, 'Wet Track Shows', getField(91));

// Distance Record (93-96)
printField(93, 'Distance Starts', getField(92));
printField(94, 'Distance Wins', getField(93));
printField(95, 'Distance Places', getField(94));
printField(96, 'Distance Shows', getField(95));

// Fields 97-101
for (let i = 96; i <= 100; i++) printField(i + 1, `Field ${i + 1}`, getField(i));

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 4: PAST PERFORMANCE DATES (Fields 102-113)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 4: PAST PERFORMANCE DATES (Fields 102-113) - 12 PPs                   │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  const date = getField(101 + i);
  let formatted = date;
  if (date.length === 8) {
    formatted = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
  }
  printField(102 + i, `PP${i + 1} Date`, date, formatted);
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 5: PP DISTANCES (Fields 114-125)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 5: PP DISTANCES IN FURLONGS (Fields 114-125)                          │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  const raw = getField(113 + i);
  const val = parseFloat(raw || '0');
  let furlongs = val;
  if (val > 16) furlongs = val / 8;
  printField(114 + i, `PP${i + 1} Distance`, raw, `${furlongs.toFixed(2)}f`);
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 6: PP TRACKS (Fields 126-137)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 6: PP TRACK CODES (Fields 126-137)                                    │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  printField(126 + i, `PP${i + 1} Track`, getField(125 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 7: PP DISTANCES IN FEET (Fields 138-149)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 7: PP DISTANCES IN FEET (Fields 138-149)                              │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  const raw = getField(137 + i);
  const feet = parseFloat(raw || '0');
  const furlongs = feet / 660;
  printField(138 + i, `PP${i + 1} Dist (ft)`, raw, feet > 0 ? `${furlongs.toFixed(2)}f` : '');
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 8: PP CONDITIONS (Fields 150-161)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 8: PP TRACK CONDITIONS (Fields 150-161)                               │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  const raw = getField(149 + i);
  let condition = raw;
  if (raw === 'ft') condition = 'Fast';
  else if (raw === 'gd') condition = 'Good';
  else if (raw === 'my') condition = 'Muddy';
  else if (raw === 'sy') condition = 'Sloppy';
  printField(150 + i, `PP${i + 1} Condition`, raw, condition);
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 9: PP EQUIPMENT (Fields 162-173)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 9: PP EQUIPMENT (Fields 162-173)                                      │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  const raw = getField(161 + i);
  let equip = raw;
  if (raw.includes('B')) equip += ' (Blinkers)';
  printField(162 + i, `PP${i + 1} Equipment`, raw, equip);
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 10: PP MEDICATION (Fields 174-185)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 10: PP MEDICATION (Fields 174-185)                                    │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  const raw = getField(173 + i);
  let med = raw;
  if (raw.includes('L')) med += ' (Lasix)';
  printField(174 + i, `PP${i + 1} Medication`, raw, med);
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 11: PP FIELD SIZE (Fields 186-197)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 11: PP FIELD SIZE (Fields 186-197)                                    │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  printField(186 + i, `PP${i + 1} Field Size`, getField(185 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 12: PP POST POSITIONS (Fields 198-209)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 12: PP POST POSITIONS (Fields 198-209)                                │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 12; i++) {
  printField(198 + i, `PP${i + 1} Post Position`, getField(197 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 13: RUNNING STYLE (Fields 210-225)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 13: RUNNING STYLE & SPEED POINTS (Fields 210-225)                     │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

printField(210, 'Running Style', getField(209));
printField(211, 'Speed Points', getField(210));
for (let i = 211; i <= 222; i++) printField(i + 1, `Field ${i + 1}`, getField(i));
printField(224, 'Best Speed Figure', getField(223));
printField(225, 'Field 225', getField(224));

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 14: WORKOUTS (Fields 256-355)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 14: WORKOUT DATA (Fields 256-355)                                     │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ WORKOUT DATES (256-265)        │                                 │');
for (let i = 0; i < 10; i++) {
  const date = getField(255 + i);
  let formatted = date;
  if (date.length === 8) {
    formatted = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
  }
  printField(256 + i, `Work${i + 1} Date`, date, formatted);
}

console.log('│      │      │ DAYS SINCE WORK (266-275)      │                                 │');
for (let i = 0; i < 10; i++) {
  printField(266 + i, `Work${i + 1} Days Ago`, getField(265 + i));
}

console.log('│      │      │ WORKOUT TRACKS (276-295)       │                                 │');
for (let i = 0; i < 10; i++) {
  printField(276 + i*2, `Work${i + 1} Track`, getField(275 + i*2));
}

console.log('│      │      │ WORKOUT RANK (296-305)         │                                 │');
for (let i = 0; i < 10; i++) {
  printField(296 + i, `Work${i + 1} Rank`, getField(295 + i));
}

console.log('│      │      │ WORKOUT CONDITION (306-315)    │                                 │');
for (let i = 0; i < 10; i++) {
  printField(306 + i, `Work${i + 1} Condition`, getField(305 + i));
}

console.log('│      │      │ WORKOUT DISTANCE (316-325)     │                                 │');
for (let i = 0; i < 10; i++) {
  const raw = getField(315 + i);
  const yards = parseFloat(raw || '0');
  const furlongs = yards / 220;
  printField(316 + i, `Work${i + 1} Distance`, raw, yards > 0 ? `${yards}yds = ${furlongs.toFixed(1)}f` : '');
}

console.log('│      │      │ WORKOUT SURFACE (326-335)      │                                 │');
for (let i = 0; i < 10; i++) {
  printField(326 + i, `Work${i + 1} Surface`, getField(325 + i));
}

console.log('│      │      │ WORKOUT TIME (336-345)         │                                 │');
for (let i = 0; i < 10; i++) {
  printField(336 + i, `Work${i + 1} Time`, getField(335 + i));
}

console.log('│      │      │ TOTAL WORKS (346-355)          │                                 │');
for (let i = 0; i < 10; i++) {
  printField(346 + i, `Work${i + 1} Total Works`, getField(345 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 15: PP FINISH DATA (Fields 356-405)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 15: PP FINISH POSITIONS & MARGINS (Fields 356-405)                    │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ FINISH POSITIONS (356-365)     │                                 │');
for (let i = 0; i < 10; i++) {
  printField(356 + i, `PP${i + 1} Finish Pos`, getField(355 + i));
}

console.log('│      │      │ FINISH MARGINS (366-375)       │                                 │');
for (let i = 0; i < 10; i++) {
  const raw = getField(365 + i);
  printField(366 + i, `PP${i + 1} Lengths Behind`, raw, raw ? `${raw} lengths` : '');
}

console.log('│      │      │ TRIP COMMENTS (396-405)        │                                 │');
for (let i = 0; i < 10; i++) {
  printField(396 + i, `PP${i + 1} Trip Comment`, getField(395 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 16: PP WINNERS/PLACE/SHOW (Fields 406-435)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 16: PP TOP 3 FINISHERS (Fields 406-435)                               │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ WINNERS (406-415)              │                                 │');
for (let i = 0; i < 10; i++) {
  printField(406 + i, `PP${i + 1} Winner`, getField(405 + i));
}

console.log('│      │      │ SECOND PLACE (416-425)         │                                 │');
for (let i = 0; i < 10; i++) {
  printField(416 + i, `PP${i + 1} 2nd Place`, getField(415 + i));
}

console.log('│      │      │ THIRD PLACE (426-435)          │                                 │');
for (let i = 0; i < 10; i++) {
  printField(426 + i, `PP${i + 1} 3rd Place`, getField(425 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 17: PP WEIGHT (Fields 436-445)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 17: PP WEIGHT CARRIED (Fields 436-445)                                │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 10; i++) {
  const raw = getField(435 + i);
  printField(436 + i, `PP${i + 1} Weight`, raw, raw ? `${raw} lbs` : '');
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 18: PP ODDS (Fields 516-525)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 18: PP FINAL ODDS (Fields 516-525)                                    │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 10; i++) {
  const raw = getField(515 + i);
  printField(516 + i, `PP${i + 1} Odds`, raw, raw ? `${raw}-1` : '');
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 19: PP RACE TYPE & CLAIMING (Fields 536-565)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 19: PP RACE TYPE & CLAIMING (Fields 536-565)                          │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ RACE TYPE (536-545)            │                                 │');
for (let i = 0; i < 10; i++) {
  printField(536 + i, `PP${i + 1} Race Type`, getField(535 + i));
}

console.log('│      │      │ CLAIMING PRICE (546-555)       │                                 │');
for (let i = 0; i < 10; i++) {
  const raw = getField(545 + i);
  printField(546 + i, `PP${i + 1} Claim Price`, raw, raw ? `$${parseInt(raw).toLocaleString()}` : '');
}

console.log('│      │      │ PURSE (556-565)                │                                 │');
for (let i = 0; i < 10; i++) {
  const raw = getField(555 + i);
  printField(556 + i, `PP${i + 1} Purse`, raw, raw ? `$${parseInt(raw).toLocaleString()}` : '');
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 20: PP RUNNING LINE - POSITIONS (Fields 566-615)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 20: PP RUNNING LINE - CALL POSITIONS (Fields 566-615)                 │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ START POSITIONS (566-575)      │                                 │');
for (let i = 0; i < 10; i++) {
  printField(566 + i, `PP${i + 1} Start Pos`, getField(565 + i));
}

console.log('│      │      │ 1ST CALL (576-585)             │                                 │');
for (let i = 0; i < 10; i++) {
  printField(576 + i, `PP${i + 1} 1st Call`, getField(575 + i));
}

console.log('│      │      │ 2ND CALL (586-595)             │                                 │');
for (let i = 0; i < 10; i++) {
  printField(586 + i, `PP${i + 1} 2nd Call`, getField(585 + i));
}

console.log('│      │      │ 3RD CALL (596-605)             │                                 │');
for (let i = 0; i < 10; i++) {
  printField(596 + i, `PP${i + 1} 3rd Call`, getField(595 + i));
}

console.log('│      │      │ STRETCH (606-615)              │                                 │');
for (let i = 0; i < 10; i++) {
  printField(606 + i, `PP${i + 1} Stretch Pos`, getField(605 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 21: PP RUNNING LINE - LENGTHS (Fields 636-715)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 21: PP RUNNING LINE - LENGTHS BEHIND (Fields 636-715)                 │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ LENGTHS @ 1ST CALL (636-645)   │                                 │');
for (let i = 0; i < 10; i++) {
  printField(636 + i, `PP${i + 1} 1st Lengths`, getField(635 + i));
}

console.log('│      │      │ LENGTHS @ 2ND CALL (656-665)   │                                 │');
for (let i = 0; i < 10; i++) {
  printField(656 + i, `PP${i + 1} 2nd Lengths`, getField(655 + i));
}

console.log('│      │      │ LENGTHS @ 3RD CALL (676-685)   │                                 │');
for (let i = 0; i < 10; i++) {
  printField(676 + i, `PP${i + 1} 3rd Lengths`, getField(675 + i));
}

console.log('│      │      │ LENGTHS @ STRETCH (696-705)    │                                 │');
for (let i = 0; i < 10; i++) {
  printField(696 + i, `PP${i + 1} Str Lengths`, getField(695 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 22: SPEED FIGURES (Fields 766-865)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 22: PP SPEED & PACE FIGURES (Fields 766-865)                          │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ BEYER SPEED FIGURES (766-775)  │                                 │');
for (let i = 0; i < 10; i++) {
  printField(766 + i, `PP${i + 1} Beyer`, getField(765 + i));
}

console.log('│      │      │ TRACK VARIANT (776-785)        │                                 │');
for (let i = 0; i < 10; i++) {
  printField(776 + i, `PP${i + 1} Variant`, getField(775 + i));
}

console.log('│      │      │ EARLY PACE E1 (816-825)        │                                 │');
for (let i = 0; i < 10; i++) {
  printField(816 + i, `PP${i + 1} Early Pace`, getField(815 + i));
}

console.log('│      │      │ LATE PACE (846-855)            │                                 │');
for (let i = 0; i < 10; i++) {
  printField(846 + i, `PP${i + 1} Late Pace`, getField(845 + i));
}

console.log('│      │      │ AVERAGE PACE (856-865)         │                                 │');
for (let i = 0; i < 10; i++) {
  printField(856 + i, `PP${i + 1} Avg Pace`, getField(855 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 23: FRACTIONAL TIMES (Fields 866-925)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 23: PP FRACTIONAL TIMES (Fields 866-1015)                             │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ QUARTER TIMES (866-875)        │                                 │');
for (let i = 0; i < 10; i++) {
  printField(866 + i, `PP${i + 1} 1/4 Time`, getField(865 + i));
}

console.log('│      │      │ HALF MILE TIMES (896-905)      │                                 │');
for (let i = 0; i < 10; i++) {
  printField(896 + i, `PP${i + 1} 1/2 Time`, getField(895 + i));
}

console.log('│      │      │ 6F TIMES (906-915)             │                                 │');
for (let i = 0; i < 10; i++) {
  printField(906 + i, `PP${i + 1} 6F Time`, getField(905 + i));
}

console.log('│      │      │ MILE TIMES (916-925)           │                                 │');
for (let i = 0; i < 10; i++) {
  printField(916 + i, `PP${i + 1} Mile Time`, getField(915 + i));
}

console.log('│      │      │ FINAL TIMES (1006-1015)        │                                 │');
for (let i = 0; i < 10; i++) {
  const raw = getField(1005 + i);
  const secs = parseFloat(raw || '0');
  let formatted = raw;
  if (secs > 0) {
    const mins = Math.floor(secs / 60);
    const secPart = (secs % 60).toFixed(2);
    formatted = mins > 0 ? `${mins}:${secPart.padStart(5, '0')}` : `:${secPart}`;
  }
  printField(1006 + i, `PP${i + 1} Final Time`, raw, formatted);
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 24: PP JOCKEYS & TRAINERS (Fields 1056-1075)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 24: PP JOCKEYS & TRAINERS (Fields 1056-1075)                          │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

console.log('│      │      │ PP TRAINERS (1056-1065)        │                                 │');
for (let i = 0; i < 10; i++) {
  printField(1056 + i, `PP${i + 1} Trainer`, getField(1055 + i));
}

console.log('│      │      │ PP JOCKEYS (1066-1075)         │                                 │');
for (let i = 0; i < 10; i++) {
  printField(1066 + i, `PP${i + 1} Jockey`, getField(1065 + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 25: TRAINER STATS (Fields 1146-1221)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 25: TRAINER CATEGORY STATISTICS (Fields 1146-1221)                    │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

// Based on DRF spec, trainer stats are in blocks of 5: starts, wins, win%, ITM%, ROI
const trainerCategories = [
  'First Time Starter',
  'First Time Lasix',
  'First Time Blinkers',
  'Blinkers Off',
  'Sprint to Route',
  'Route to Sprint',
  'Turf Sprint',
  'Turf Route',
  'Dirt Sprint',
  'Dirt Route',
  'Wet Track',
  '31-60 Days',
  '61-90 Days',
  '91-180 Days',
  '181+ Days'
];

let startIdx = 1145;
for (let cat = 0; cat < trainerCategories.length && startIdx + 4 < horseFields.length; cat++) {
  console.log(`│      │      │ ${trainerCategories[cat]?.padEnd(30) || ''} │                                 │`);
  printField(startIdx + 1, `  Starts`, getField(startIdx));
  printField(startIdx + 2, `  Win%`, getField(startIdx + 1));
  printField(startIdx + 3, `  ITM%`, getField(startIdx + 2));
  printField(startIdx + 4, `  ROI`, getField(startIdx + 3));
  startIdx += 5;
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 26: JOCKEY STATS (Fields around 1220-1280)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 26: JOCKEY STATISTICS (Fields ~1220-1280)                             │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

// Jockey stats typically follow trainer stats
const jockeyStart = 1220;
for (let i = 0; i < 30 && jockeyStart + i < horseFields.length; i++) {
  printField(jockeyStart + i + 1, `Jockey Field ${i + 1}`, getField(jockeyStart + i));
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// SECTION 27: TRIP NOTES (Fields 1383-1392)
// ============================================================================
console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ SECTION 27: DETAILED TRIP NOTES (Fields 1383-1392)                            │');
console.log('├──────┬──────┬────────────────────────────────┬─────────────────────────────────┤');

for (let i = 0; i < 10; i++) {
  const val = getField(1382 + i);
  printField(1383 + i, `PP${i + 1} Trip Notes`, val.substring(0, 30), val);
}

console.log('└──────┴──────┴────────────────────────────────┴─────────────────────────────────┘');
console.log('');

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                              SUMMARY                                           ║');
console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
console.log(`║ Horse: ${HORSE_NAME.padEnd(70)}║`);
console.log(`║ Total Fields: ${String(horseFields.length).padEnd(63)}║`);
console.log(`║ PP Dates Found: ${[0,1,2,3,4,5,6,7,8,9,10,11].filter(i => getField(101 + i)).length.toString().padEnd(61)}║`);
console.log(`║ Workouts Found: ${[0,1,2,3,4,5,6,7,8,9].filter(i => getField(255 + i)).length.toString().padEnd(61)}║`);
console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
