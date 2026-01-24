/**
 * Guide Content
 *
 * User guides and documentation for Furlong Pro Handicapping.
 */

export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  content: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket_launch',
    content: `# Getting Started with Furlong

Welcome to Furlong Pro Handicapping! This guide will walk you through uploading your first DRF file and interpreting the results.

## Step 1: Obtain a DRF File

Purchase a DRF (Daily Racing Form) file from drf.com for the race card you want to analyze. These files contain all the past performance data our algorithm needs.

## Step 2: Upload Your File

Click the upload area on the Dashboard or drag and drop your DRF file directly. The system accepts .DRF files up to 10MB in size.

## Step 3: Wait for Analysis

Furlong parses all race entries and runs our 6-category scoring algorithm. This typically takes 2-3 seconds for a full race card.

## Step 4: Review the Race Overview

After parsing, you'll see all races displayed as cards with:
- Race number and conditions (distance, surface, class)
- Top contender and their tier
- Confidence badge (High/Medium/Low)

## Step 5: Drill Into Race Details

Click any race card to see the full breakdown:
- All horses ranked by score
- Tier assignments and betting recommendations
- Score breakdowns by category
- Horse details with past performance data

## Step 6: Make Adjustments

Update scratches, adjust track conditions, or enter current odds to recalculate recommendations in real-time.

## Tips for Best Results

- Upload the DRF file as close to race time as possible for accurate morning line odds
- Check for late scratches before betting
- Update odds from the tote board for true value detection
- Trust the tiers—Tier 1 horses deserve the bulk of your action`,
  },
  {
    id: 'understanding-scores',
    title: 'Understanding Scores',
    icon: 'analytics',
    content: `# Understanding the Scoring System

Furlong's scoring algorithm evaluates every horse across six distinct categories, producing a comprehensive score that drives betting recommendations.

## The 6 Scoring Categories

### 1. Elite Connections (50 points max)
Evaluates trainer and jockey quality based on win rates, ROI, and situational statistics. Top trainers at specific tracks or with specific running styles earn maximum points.

- **Trainer Score:** 0-35 points
- **Jockey Score:** 0-15 points

### 2. Post Position & Track Bias (45 points max)
Analyzes starting position relative to track-specific bias data. Some tracks heavily favor inside posts in sprints or outside posts in routes.

- **Post Position:** 0-30 points
- **Bias Alignment:** 0-15 points

### 3. Speed Figures & Class (50 points max)
Compares recent speed figures and class levels. Horses stepping down in class or showing improving figures earn high marks.

- **Speed Figures:** 0-30 points
- **Class Level:** 0-20 points

### 4. Form Cycle & Conditioning (30 points max)
Evaluates recent form, layoff impact, and consistency patterns. Horses in peak form with reasonable layoffs score highest.

- **Recent Form:** 0-15 points
- **Layoff Impact:** 0-10 points
- **Consistency:** 0-5 points

### 5. Equipment & Medication (25 points max)
Tracks equipment changes (blinkers, bandages, shoes) and medication status that often signal trainer intent.

- **Equipment Changes:** 0-15 points
- **Medication:** 0-5 points
- **Shoeing:** 0-5 points

### 6. Pace & Tactical (40 points max)
Projects race pace scenarios and identifies horses with tactical advantages—closers in hot pace races, lone speed in slow fields.

- **Pace Scenario Fit:** 0-25 points
- **Tactical Advantages:** 0-15 points

## Base Score Range: 0-331 Points

## DRF Overlay Adjustments

After base scoring, race-day factors can adjust the score by ±40 points:
- Pace dynamics changes
- Form cycle specifics
- Trip analysis
- Class movement patterns
- Connection edges
- Distance/surface preferences
- Head-to-head matchups

## Final Score Interpretation

| Score Range | Meaning | Hit Rate |
|-------------|---------|----------|
| 200+ | Elite contender | 50-70% |
| 180-199 | Strong contender | 40-50% |
| 160-179 | Competitive | 20-40% |
| 140-159 | Marginal | 5-20% |
| <140 | Pass | — |`,
  },
  {
    id: 'betting-strategy',
    title: 'Betting Strategy',
    icon: 'attach_money',
    content: `# Betting Strategy Guide

Furlong provides structured betting recommendations based on proven handicapping principles. This guide explains how to use tier assignments and manage your bankroll effectively.

## The Three-Tier System

### Tier 1 — Chalk (Primary Bets)
**Score: 180+ points | Hit Rate: 50-70%**

These are your highest-conviction plays. Tier 1 horses have multiple scoring factors aligned and represent the strongest value propositions.

- **Bet Types:** Win, Win-Place, Exacta keys
- **Unit Size:** 2-3 units
- **Strategy:** Bet confidently but never chase losses

### Tier 2 — Alternatives (Secondary Bets)
**Score: 160-179 points | Hit Rate: 20-40%**

Solid contenders that belong in exotic tickets but may not warrant straight win bets at short odds.

- **Bet Types:** Place, Show, Exacta/Trifecta wheels
- **Unit Size:** 1-2 units
- **Strategy:** Use underneath Tier 1 horses in exotics

### Tier 3 — Value (Small Stabs)
**Score: 140-159 points | Hit Rate: 5-20%**

Long shots with identifiable angles. Only play when odds justify the risk.

- **Bet Types:** Show, Trifecta/Superfecta inclusions
- **Unit Size:** 0.5-1 unit
- **Strategy:** Minimum exposure, maximum payoff potential

## Bankroll Management Basics

### Setting Your Bankroll
Your bankroll should be money you can afford to lose. Never bet rent money, bill money, or borrowed funds.

### Unit Sizing
A "unit" should be 1-2% of your total bankroll. If your bankroll is $500, one unit is $5-10.

### The 5% Rule
Never bet more than 5% of your bankroll on a single race, regardless of confidence level.

### Session Limits
Set daily or session loss limits. If you lose 20% of your bankroll, stop for the day.

## Practical Application

**Example Race Card with $500 Bankroll ($5 unit):**

| Race | Top Pick | Tier | Bet Type | Units | Wager |
|------|----------|------|----------|-------|-------|
| R1 | #5 | Tier 1 | Win | 2 | $10 |
| R3 | #2 | Tier 1 | WP | 3 | $15 |
| R4 | #7 | Tier 2 | Place | 1 | $5 |
| R6 | #3 | Tier 3 | Show | 0.5 | $2.50 |

## Key Principles

1. **Trust the Tiers** — The algorithm did the work. Don't override Tier 1 picks with hunches.

2. **Patience Pays** — Not every race deserves a bet. Pass on races with no Tier 1 contenders.

3. **Value Over Volume** — One smart bet beats five reckless ones.

4. **Adjust to Odds** — Morning line doesn't matter at post time. Update odds and recalculate.

5. **Track Your Bets** — Keep records. Know your ROI. Improve over time.

## When to Pass

- No Tier 1 horses in the race
- Heavy favorite with no value
- Too many unknowns (first-time starters, track variant)
- You've hit your session limit

Remember: The best bet is sometimes no bet at all.`,
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features',
    icon: 'settings_suggest',
    content: `# Advanced Features

Once you're comfortable with the basics, explore these advanced features to maximize your handicapping edge.

## Real-Time Recalculation

Furlong recalculates all scores instantly when you make changes:

- **Scratch a Horse:** Click the scratch toggle and watch odds and pace projections update
- **Change Track Condition:** Adjust from Fast to Muddy to see which horses benefit
- **Update Odds:** Enter current tote odds to find true overlays

The system never loses data—all changes can be reset with one click.

## Score Breakdown Views

Click any horse to see their complete scoring breakdown:

- Points earned in each of the 6 categories
- Specific factors that contributed to their score
- Historical performance data
- Trainer and jockey statistics at this track

## Multi-Race Exotics

For Pick 3, Pick 4, and Pick 5 wagers:

1. Identify Tier 1 "singles" (races with clear top choices)
2. Spread in races with multiple contenders
3. Use Tier 2 horses for ticket protection
4. Calculate cost before confirming

## Keyboard Shortcuts

Navigate efficiently with these shortcuts:

- **Escape:** Return to Race Overview from Detail view
- **R:** Reset current race changes
- **Arrow Keys:** Navigate between races
- **?:** Show keyboard shortcuts help

## Confidence Indicators

The colored confidence badges provide quick reference:

- **Green (High):** Multiple strong factors, clear top choice
- **Yellow (Medium):** Solid but competitive field
- **Orange (Low):** Uncertain outcome, consider passing

## Track Intelligence

Each track profile includes:

- Surface type and dimensions
- Post position win percentages by distance
- Speed vs. pace bias indicators
- Par times for accurate figure comparison

Access track info by clicking the track code in the race header.

## Offline Mode

Furlong works completely offline at the track:

- Parse DRF files without connection
- All scoring calculations run locally
- Track database stored in IndexedDB
- Sync when you're back online

Install Furlong to your home screen for the best offline experience.`,
  },
];
