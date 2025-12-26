# DRF FIELD MAP v2.0

## Corrected for BRIS 12-PP Format

> **Version 2.0 - Corrected for 12-PP format**
>
> This document maps every field in the DRF (Daily Racing Form) file format using the correct BRIS 12-PP specification. Previous versions incorrectly used 10-PP format indices.
>
> **CRITICAL CHANGES FROM v1.0:**
>
> - Field 6 is Distance (yards), NOT Post Time
> - Fields 62-64 are Medication flags, NOT Lifetime Starts
> - Lifetime stats shifted by 3 positions (Fields 65-69)
> - All PP blocks use 12 fields, NOT 10
> - Turf/Wet/Distance/Track records are reordered (Fields 80-101)

---

## DRF FILE STRUCTURE OVERVIEW

### File Format Specifications

- **Format:** CSV (Comma-Separated Values)
- **Fields Per Line:** 1,435
- **One Line Per:** Horse entry
- **Encoding:** ASCII
- **File Extension:** .DRF
- **PP Count:** 12 (NOT 10!)

### Field Group Summary

| Field Range | Content Category                       |
| ----------- | -------------------------------------- |
| 1-27        | Race Header Information                |
| 28-61       | Horse Identity & Connections           |
| 62-64       | Today's Medication Flags               |
| 65-69       | Lifetime Performance Records           |
| 70-74       | Current Year Stats                     |
| 75-79       | Previous Year Stats                    |
| 80-84       | Turf Record                            |
| 85          | Best Turf Year                         |
| 86-90       | Wet Track Record                       |
| 91          | Best Wet Year                          |
| 92-96       | Distance Record                        |
| 97-101      | Track Record                           |
| 102-113     | PP Dates (12 entries)                  |
| 114-125     | PP Distances in Furlongs (12 entries)  |
| 126-137     | PP Track Codes (12 entries)            |
| 138-149     | PP Distances in Yards (12 entries)     |
| 150-161     | PP Track Conditions (12 entries)       |
| 162-173     | PP Equipment (12 entries)              |
| 174-185     | PP Medication (12 entries)             |
| 186-197     | PP Days Since Previous (12 entries)    |
| 198-209     | PP Finish Position (12 entries)        |
| 256-267     | Workout Dates (12 entries)             |
| 268-279     | Workout Tracks (12 entries)            |
| 280-291     | Workout Distances (12 entries)         |
| 292-303     | Workout Times (12 entries)             |
| 304-315     | Workout Rankings (12 entries)          |
| 346-357     | PP Field Size (12 entries)             |
| 354-365     | PP Odds (12 entries)                   |
| 766-777     | PP Speed Figures (12 entries)          |
| 778-789     | PP Track Variants (12 entries)         |
| 816-827     | PP E1 Pace (12 entries)                |
| 846-857     | PP Late Pace (12 entries)              |
| 1056-1067   | PP Trainers (12 entries)               |
| 1068-1079   | PP Jockeys (12 entries)                |
| 1146-1221   | Trainer Category Stats (19 categories) |
| 1383-1392   | Detailed Trip Notes (10 entries)       |
| 1420-1429   | EQB Race Conditions (10 entries)       |

---

## SECTION 1: RACE HEADER (Fields 1-27)

| Field | Name                   | Type      | Description                                | 0-Index |
| ----- | ---------------------- | --------- | ------------------------------------------ | ------- |
| 1     | Track Code             | CHAR(3)   | 3-letter track identifier ("PEN")          | 0       |
| 2     | Race Date              | CHAR(8)   | YYYYMMDD format                            | 1       |
| 3     | Race Number            | NUM       | Race number on card                        | 2       |
| 4     | Post Position          | NUM       | Horse's post position                      | 3       |
| 5     | Entry Flag             | CHAR(1)   | A/B/C=coupled, F=field, S=scratched        | 4       |
| 6     | Distance (yards)       | NUM       | Race distance in yards (1760 = 1 mile)     | 5       |
| 7     | Surface                | CHAR(1)   | D=dirt, T=turf, d=inner dirt, t=inner turf | 6       |
| 8     | Reserved               |           |                                            | 7       |
| 9     | Race Type              | CHAR(2)   | G1/G2/G3/N/A/C/S/M/CO etc                  | 8       |
| 10    | Age/Sex Restrictions   | CHAR(3)   | 3-char code (e.g., "BUN")                  | 9       |
| 11    | Race Classification    | CHAR(14)  | Abbreviated conditions ("Clm 10000n2l")    | 10      |
| 12    | Purse                  | NUM       | Total purse amount                         | 11      |
| 13    | Claiming Price (high)  | NUM       | High claiming price for race               | 12      |
| 14    | Claiming Price (horse) | NUM       | This horse's claiming price                | 13      |
| 15    | Track Record           | NUM       | Track record in seconds                    | 14      |
| 16    | Race Conditions        | CHAR(500) | Full race conditions text                  | 15      |
| 17    | Top Picks              | CHAR      | Semicolon-separated horse names            | 16      |
| 18    | Today's Lasix List     | CHAR      | Horses on Lasix                            | 17      |
| 19    | Today's Bute List      | CHAR      | Horses on Bute                             | 18      |
| 20    | Today's Coupled List   | CHAR      | Coupled entries                            | 19      |
| 21    | Simulcast Track        | CHAR(3)   | Host track code                            | 20      |
| 22    | Simulcast Race         | NUM       | Host race number                           | 21      |
| 23    | Breed Type             | CHAR(2)   | TB/QH/AR                                   | 22      |
| 24    | Field Size             | NUM       | Number of starters                         | 23      |
| 25-27 | Reserved               |           |                                            | 24-26   |

**CRITICAL:** Field 6 is Distance in Yards, NOT Post Time!

---

## SECTION 2: HORSE IDENTITY & CONNECTIONS (Fields 28-61)

| Field | Name                  | Type     | Description             | 0-Index |
| ----- | --------------------- | -------- | ----------------------- | ------- |
| 28    | Trainer Name          | CHAR(30) | Full trainer name       | 27      |
| 29    | Trainer Starts (meet) | NUM      | Current meet starts     | 28      |
| 30    | Trainer Wins (meet)   | NUM      | Current meet wins       | 29      |
| 31    | Trainer Places (meet) | NUM      | Current meet places     | 30      |
| 32    | Trainer Shows (meet)  | NUM      | Current meet shows      | 31      |
| 33    | Jockey Name           | CHAR(25) | Full jockey name        | 32      |
| 34    | Jockey Apprentice Wt  | NUM      | Apprentice allowance    | 33      |
| 35    | Jockey Starts (meet)  | NUM      | Current meet starts     | 34      |
| 36    | Jockey Wins (meet)    | NUM      | Current meet wins       | 35      |
| 37    | Jockey Places (meet)  | NUM      | Current meet places     | 36      |
| 38    | Jockey Shows (meet)   | NUM      | Current meet shows      | 37      |
| 39    | Owner Name            | CHAR(40) | Owner name              | 38      |
| 40    | Silks Description     | CHAR     | Silks colors            | 39      |
| 41-42 | Reserved              |          |                         | 40-41   |
| 43    | Program Number        | CHAR(3)  | Official program number | 42      |
| 44    | Morning Line Odds     | NUM      | Morning line (to $1)    | 43      |
| 45    | Horse Name            | CHAR(25) | Full horse name         | 44      |
| 46    | Age (years)           | NUM      | Horse age in years      | 45      |
| 47    | Age (months)          | NUM      | Additional months       | 46      |
| 48    | Reserved              |          |                         | 47      |
| 49    | Sex Code              | CHAR(1)  | C/F/M/G/H/R             | 48      |
| 50    | Color                 | CHAR(2)  | B/Br/Ch/Gr/Blk          | 49      |
| 51    | Weight                | NUM      | Assigned weight         | 50      |
| 52    | Sire Name             | CHAR(25) | Sire name               | 51      |
| 53    | Sire's Sire           | CHAR(25) | Paternal grandsire      | 52      |
| 54    | Dam Name              | CHAR(25) | Dam name                | 53      |
| 55    | Dam's Sire            | CHAR(25) | Broodmare sire          | 54      |
| 56    | Breeder               | CHAR(60) | Breeder name            | 55      |
| 57    | State/Country Bred    | CHAR(5)  | Where bred              | 56      |
| 58-61 | Reserved              |          |                         | 57-60   |

---

## SECTION 3: LIFETIME & SEASONAL RECORDS (Fields 62-101)

**CRITICAL:** These fields are shifted by 3 from the old 10-PP format!

### Medication Flags (Fields 62-64)

| Field | Name               | Description                     | 0-Index |
| ----- | ------------------ | ------------------------------- | ------- |
| 62    | Today's Medication | 0=none, 1=Lasix, 2=Bute, 3=both | 61      |
| 63    | First Time Lasix   | First time Lasix flag           | 62      |
| 64    | Reserved           |                                 | 63      |

### Lifetime Record (Fields 65-69)

| Field | Name              | Description           | 0-Index |
| ----- | ----------------- | --------------------- | ------- |
| 65    | Lifetime Starts   | Total career starts   | 64      |
| 66    | Lifetime Wins     | Total career wins     | 65      |
| 67    | Lifetime Places   | Total career places   | 66      |
| 68    | Lifetime Shows    | Total career shows    | 67      |
| 69    | Lifetime Earnings | Total career earnings | 68      |

### Current Year Record (Fields 70-74)

| Field | Name                  | Description        | 0-Index |
| ----- | --------------------- | ------------------ | ------- |
| 70    | Current Year Starts   | Starts this year   | 69      |
| 71    | Current Year Wins     | Wins this year     | 70      |
| 72    | Current Year Places   | Places this year   | 71      |
| 73    | Current Year Shows    | Shows this year    | 72      |
| 74    | Current Year Earnings | Earnings this year | 73      |

### Previous Year Record (Fields 75-79)

| Field | Name                   | Description        | 0-Index |
| ----- | ---------------------- | ------------------ | ------- |
| 75    | Previous Year Starts   | Starts last year   | 74      |
| 76    | Previous Year Wins     | Wins last year     | 75      |
| 77    | Previous Year Places   | Places last year   | 76      |
| 78    | Previous Year Shows    | Shows last year    | 77      |
| 79    | Previous Year Earnings | Earnings last year | 78      |

### Turf Record (Fields 80-84)

| Field | Name          | Description   | 0-Index |
| ----- | ------------- | ------------- | ------- |
| 80    | Turf Starts   | Turf starts   | 79      |
| 81    | Turf Wins     | Turf wins     | 80      |
| 82    | Turf Places   | Turf places   | 81      |
| 83    | Turf Shows    | Turf shows    | 82      |
| 84    | Turf Earnings | Turf earnings | 83      |

### Best Turf Year (Field 85)

| Field | Name           | Description                               | 0-Index |
| ----- | -------------- | ----------------------------------------- | ------- |
| 85    | Best Turf Year | Year of best turf race (NOT turf starts!) | 84      |

**THIS WAS THE "2025" BUG!** Field 85 contains a YEAR value, not a count!

### Wet Track Record (Fields 86-90)

| Field | Name               | Description          | 0-Index |
| ----- | ------------------ | -------------------- | ------- |
| 86    | Wet Track Starts   | Wet/off track starts | 85      |
| 87    | Wet Track Wins     | Wet track wins       | 86      |
| 88    | Wet Track Places   | Wet track places     | 87      |
| 89    | Wet Track Shows    | Wet track shows      | 88      |
| 90    | Wet Track Earnings | Wet track earnings   | 89      |

### Best Wet Year (Field 91)

| Field | Name          | Description           | 0-Index |
| ----- | ------------- | --------------------- | ------- |
| 91    | Best Wet Year | Year of best wet race | 90      |

### Distance Record (Fields 92-96)

| Field | Name              | Description               | 0-Index |
| ----- | ----------------- | ------------------------- | ------- |
| 92    | Distance Starts   | Today's distance starts   | 91      |
| 93    | Distance Wins     | Today's distance wins     | 92      |
| 94    | Distance Places   | Today's distance places   | 93      |
| 95    | Distance Shows    | Today's distance shows    | 94      |
| 96    | Distance Earnings | Today's distance earnings | 95      |

### Track Record (Fields 97-101)

| Field | Name           | Description         | 0-Index |
| ----- | -------------- | ------------------- | ------- |
| 97    | Track Starts   | This track starts   | 96      |
| 98    | Track Wins     | This track wins     | 97      |
| 99    | Track Places   | This track places   | 98      |
| 100   | Track Shows    | This track shows    | 99      |
| 101   | Track Earnings | This track earnings | 100     |

---

## SECTION 4: PAST PERFORMANCE BLOCKS (12 PPs each)

**CRITICAL:** All core PP blocks repeat 12 times (PP1-PP12), stored column-major.

| Data Type               | Start Field | End Field | 0-Index Start | Count | Description                 |
| ----------------------- | ----------- | --------- | ------------- | ----- | --------------------------- |
| PP Dates                | 102         | 113       | 101           | 12    | YYYYMMDD, most recent first |
| PP Distances (furlongs) | 114         | 125       | 113           | 12    | Distance in furlongs        |
| PP Track Codes          | 126         | 137       | 125           | 12    | 3-letter track codes        |
| PP Distances (yards)    | 138         | 149       | 137           | 12    | Distance in yards           |
| PP Track Conditions     | 150         | 161       | 149           | 12    | ft/gd/sy/my/fm/sf/yl        |
| PP Equipment            | 162         | 173       | 161           | 12    | B=blinkers, etc             |
| PP Medication           | 174         | 185       | 173           | 12    | Lasix/Bute codes            |
| PP Days Since Previous  | 186         | 197       | 185           | 12    | Days between races          |
| PP Finish Position      | 198         | 209       | 197           | 12    | Where horse finished        |
| PP Field Size           | 346         | 357       | 345           | 12    | Horses in race              |
| PP Odds                 | 354         | 365       | 353           | 12    | Final odds                  |
| PP Speed Figures        | 766         | 777       | 765           | 12    | Beyer/BRIS speed            |
| PP Track Variants       | 778         | 789       | 777           | 12    | Track variant               |
| PP 2F Pace              | 786         | 797       | 785           | 12    | 2-furlong pace              |
| PP E1 Pace              | 816         | 827       | 815           | 12    | Early pace figure           |
| PP Late Pace            | 846         | 857       | 845           | 12    | Late pace figure            |
| PP Trainers             | 1056        | 1067      | 1055          | 12    | Trainer for that race       |
| PP Jockeys              | 1068        | 1079      | 1067          | 12    | Jockey for that race        |

---

## SECTION 5: WORKOUTS (12 workouts)

| Data Type         | Start Field | End Field | 0-Index Start | Count |
| ----------------- | ----------- | --------- | ------------- | ----- |
| Workout Dates     | 256         | 267       | 255           | 12    |
| Workout Tracks    | 268         | 279       | 267           | 12    |
| Workout Distances | 280         | 291       | 279           | 12    |
| Workout Times     | 292         | 303       | 291           | 12    |
| Workout Rankings  | 304         | 315       | 303           | 12    |

---

## SECTION 6: SUPPLEMENTAL (10 fields, not 12)

These supplemental sections still use 10 fields (historical format):

| Data Type             | Start Field | End Field | 0-Index Start | Count |
| --------------------- | ----------- | --------- | ------------- | ----- |
| Trip Notes (detailed) | 1383        | 1392      | 1382          | 10    |
| EQB Race Conditions   | 1420        | 1429      | 1419          | 10    |

---

## SECTION 7: TRAINER CATEGORY STATS (Fields 1146-1221)

19 trainer categories, each with: Label, Starts, Win%, ITM%, ROI

| Category    | Label Field | Stats Fields | 0-Index Start |
| ----------- | ----------- | ------------ | ------------- |
| Category 1  | 1146        | 1147-1150    | 1145          |
| Category 2  | 1151        | 1152-1155    | 1150          |
| ...         | ...         | ...          | ...           |
| Category 19 | 1218        | 1219-1221    | 1217          |

---

## ANCHOR POINTS FOR VALIDATION

Use these known anchor points to verify field mapping is correct:

| Field | Index | Content           | Expected Value                 |
| ----- | ----- | ----------------- | ------------------------------ |
| 1     | 0     | Track Code        | 3-letter code (e.g., "PEN")    |
| 28    | 27    | Trainer Name      | Full trainer name              |
| 45    | 44    | Horse Name        | Full horse name                |
| 766   | 765   | PP1 Speed Figure  | Number 0-130                   |
| 777   | 776   | PP12 Speed Figure | Number 0-130 (if 12 PPs)       |
| 85    | 84    | Best Turf Year    | Year (e.g., 2025), NOT a count |

---

## COMMON BUGS FROM WRONG FIELD MAP

### The "2025" Bug

**Symptom:** `turfStarts` shows 2025 instead of a small number
**Cause:** Reading Field 85 (Best Turf Year) as turf starts
**Fix:** Turf starts is Field 80 (index 79), not Field 85 (index 84)

### Speed Figure Overflow

**Symptom:** PP11 and PP12 speed figures are garbage
**Cause:** Using 10-field spans instead of 12-field spans
**Fix:** Speed figures are Fields 766-777 (12 fields), not 766-775 (10 fields)

### Shifted Lifetime Stats

**Symptom:** Lifetime starts/wins/places/shows all wrong
**Cause:** Not accounting for medication fields 62-64
**Fix:** Lifetime starts is Field 65 (index 64), not Field 62 (index 61)

---

## VERSION HISTORY

- **v2.0** (2025-12-26): Corrected for 12-PP format, validated against PEN0821.DRF
- **v1.0** (original): Based on incorrect 10-PP format
