# TREND RANK METHODOLOGY

## Core Concept
Rolling window analysis with recency weighting. Instead of flat averages, compare recent performance windows to older windows to detect trajectory.

## Rolling Windows Calculated
For each horse's last 10 races (1 = most recent):
- Window 1: Race 1 only (current form)
- Window 1-2: Races 1-2 avg (very recent)
- Window 1-3: Races 1-3 avg (short-term)
- Window 1-4: Races 1-4 avg (medium-term)
- Window 1-5: Races 1-5 avg (established)
- Window 4-5: Races 4-5 avg (old baseline)
- Window 3-5: Races 3-5 avg (older trend)

## Key Comparisons
- Recent (1-2) vs Old (4-5) = Primary trend direction
- Recent (1-3) vs Old (3-5) = Secondary confirmation
- Race 1 vs Race 5 = Single point extreme comparison

## Trend Formula
Trend Score = (Old Window Avg) - (Recent Window Avg)
Positive = Improving (lower finish numbers = better)
Negative = Declining
Zero = Flat

## Metrics Analyzed (apply rolling windows to each):
1. Finish Position - Getting closer to winning?
2. Beyer Figures - Getting faster?
3. Beaten Lengths - Losing by less?
4. Position at First Call - Breaking better?
5. Position at Stretch Call - In position late?
6. Ground Gained/Lost in Stretch - Finishing stronger?
7. Class Level - Rising or falling successfully?
8. Odds - Public catching on or losing faith?

## Trend Direction Thresholds
- Improving: Trend Score > +1.0
- Declining: Trend Score < -1.0
- Flat: Between -1.0 and +1.0

## Trend Strength Scale
- Minor: 0.5 - 1.5
- Moderate: 1.5 - 3.0
- Significant: 3.0 - 4.5
- Explosive: 4.5+

## Confidence Calculation
HIGH: 3+ metrics trending same direction
MEDIUM: 2 metrics trending same direction
LOW: Mixed signals or insufficient data

## Additional Trend Flags (Boolean):
- Workout pattern trending (bullets increasing?)
- Days since last race optimal (14-30 days)?
- Class dropping with form improving?
- Jockey upgrade from last race?
- Trainer hot streak (3+ wins last 14 days)?
- Equipment change (first time blinkers, etc)?
- Layoff with bullet work?
- Back to winning distance?
- Surface switch to preferred?

## Final Trend Rank
Composite of all rolling window trends + flags, normalized to rank horses 1 to N in field.

## Visual Specification
- Sparkline thumbnail: 60px wide, 20px tall, no labels
- Color: Green (improving), Red (declining), Yellow (flat)
- Click expands to modal with full interactive graph
