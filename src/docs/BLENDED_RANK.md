# BLENDED RANK METHODOLOGY

## Purpose

Combine static ability (Base Rank) with dynamic momentum (Trend Rank) into single actionable ranking.

## Inputs

- Base Rank: Current 336-point algorithm (who SHOULD win based on ability)
- Trend Rank: Rolling window analysis (who is PEAKING right now)

## Formula

Blended Score = (Base Rank Points × Base Weight) + (Trend Rank Points × Trend Weight)

## Default Weights (subject to tuning after 50+ race validation)

- Base Weight: 0.60 (60%)
- Trend Weight: 0.40 (40%)

## Rationale

- Base captures fundamental ability, class, connections, speed
- Trend captures momentum, trajectory, current form cycle
- Neither alone tells the full story

## Edge Cases

- Missing trend data (fewer than 3 races): Use Base Rank only, flag as "Limited Trend Data"
- Missing base data: Do not rank, flag as "Insufficient Data"

## Interpretation Guide

| Base Rank | Trend Rank | Blended | Meaning                      |
| --------- | ---------- | ------- | ---------------------------- |
| #1        | #1         | #1      | Strongest conviction bet     |
| #1        | #5         | #2-3    | Good horse, may be declining |
| #5        | #1         | #2-3    | Upset alert, momentum horse  |
| #3        | #3         | #2-3    | Consistent, reliable         |

## Agreement Signal

When Base and Trend agree within 1 position = HIGH CONFIDENCE
When Base and Trend differ by 3+ positions = DIG DEEPER or SKIP

## Future Tuning

After 50+ race validation:

- Adjust Base/Trend weights based on predictive accuracy
- Consider situational weights (sprints vs routes, class levels)
