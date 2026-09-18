# Actionable insight measures

Status: first version implemented on the Insights page.

This document records the intended first version of the app's actionable
measures. Its purpose is to make the rationale, assumptions, and tuning points
explicit before code is written. A displayed score must be accompanied by its
evidence and confidence, rather than presented as a diagnosis or prescription.

## Data contract and shared safeguards

Strong and Hevy imports are normalized to the same workout identifier, date,
exercise name, set order, load, reps, and optional RPE fields.
`exercise-muscles.js` maps exercises to primary and secondary muscles.

- A **working set** is one imported logged set, excluding sets that Hevy
  explicitly marks as warm-ups. Volume is hard-set count, not load multiplied
  by reps. Positive load and reps are required only for estimated-1RM
  performance calculations.
- **Direct volume** counts sets for primary muscles only. **Total volume**
  counts direct sets plus half of indirect sets and supplies the Opportunity
  score's volume component.
- A **session-best performance observation** is an exercise's highest Epley
  estimated 1RM in one workout: `load * (1 + reps / 30)`.
- Two observations are **comparable** when their median rep counts differ by
  no more than three reps. This limits misleading comparisons between distinct
  rep-range phases.
- Weekly measures use complete Monday-Sunday weeks only; partial edge weeks
  are excluded.
- Performance measures require at least six comparable exercise sessions over
  at least six weeks. Below this threshold, show “Not enough comparable data,”
  not a numeric score.
- Unmapped exercises are excluded from muscle-level measures and called out in
  the confidence note.

These gates exist because a one-off PR, a short training block, a rep-range
change, or missing muscle mapping should not be treated as reliable evidence.

## Efficiency score — per exercise

### Question answered

“How strong has my performance response been relative to the amount of this
exercise I logged?” It is not a measure of effort, genetic potential, or the
quality of a program.

### Calculation

For a selected period, compare the median session-best estimated 1RM of the
first three comparable sessions with that of the last three. Let `changePct`
be that percentage change, `weeks` be the number of complete weeks in the
period, and `setsPerWeek` be the exercise's average logged working sets per
week.

```
progressRate = 4 * changePct / (weeks * max(setsPerWeek, 2))
score = clamp(50 + 25 * progressRate, 0, 100)
```

The two-set floor prevents an occasional exercise from receiving an inflated
score merely because its denominator is very small. A score of 50 represents
no meaningful net progress; it is not a pass/fail threshold.

| Score | Interpretation |
| --- | --- |
| 75–100 | Strong observed response |
| 60–74 | Positive observed response |
| 45–59 | Little net observed response |
| 0–44 | Declining observed response |

The formula makes the measure transparent for an initial release. The scaling
constants (`4`, `2`, and `25`) are provisional and should later be calibrated
against real, consented historical usage rather than claimed as universal
training norms.

### Required explanation

Show score, estimated-1RM change, comparable-session count, period length,
and average working sets/week. Example: “76 — estimated 1RM rose 5.2% across
10 comparable sessions at 3.1 sets/week.”

## Opportunity score — per muscle group

### Question answered

“Is there a clear reason to review this muscle group's current setup?” A high
score means an actionable review is warranted; it never automatically means
“add more volume.” This distinction prevents low performance stability from
being translated into an unsafe volume recommendation.

### Calculation

Use weighted total-set volume and direct-session frequency for the mapped
muscle. Total volume is direct sets plus half of indirect sets. Let `recovery`
be the whole-program Performance-stability recovery proxy below.

```
volumeGap = 40 * clamp((5 - totalSetsPerWeek) / 5, 0, 1)
frequencyGap = 30 * clamp((2 - directSessionsPerWeek) / 2, 0, 1)
stabilityFlag = 30 * clamp((80 - recovery) / 40, 0, 1)
opportunity = volumeGap + frequencyGap + stabilityFlag
```

The 5-set and twice-weekly anchors are review triggers, not minimum effective
or required targets. They intentionally remain centralized configuration
values. The UI must show all three point contributions.

### Decision language

- Low exposure and recovery score at least 80: if the muscle is a stated
  priority, suggest one small additional direct exposure or 1–2 sets/week, then
  reassess after 3–4 weeks.
- Low recovery: advise against adding volume first; stabilize the setup and
  investigate the repeated performance decline.
- Low exposure with no stated goal: describe the exposure fact without calling
  it a deficit.

## Consistency score — whole program

### Question answered

“How steady was my weekly workout frequency?” It measures regularity, not
whether the user trained often enough. One session every week can therefore be
perfectly consistent.

### Calculation

Across complete weeks, let `meanFrequency` be mean workout sessions/week and
`MAD` be the mean absolute deviation of weekly frequency from that mean.

```
score = 100 * clamp(1 - (MAD / max(meanFrequency, 1)) / 0.75, 0, 1)
```

Require four complete weeks. Display the average frequency and typical weekly
deviation alongside the score. The `0.75` scaling factor is a deliberately
visible tuning parameter, to be evaluated using observed score distributions.

## Plateau detection — per exercise

### Question answered

“Does this exercise have enough stable, comparable evidence of stalled
performance to warrant review?” A plateau is a pattern, not a diagnosis.

### Calculation and status rules

Plateau is primarily a **selected-period** question. Use the median estimated
1RM of the first three comparable sessions as the baseline and the median of
the last three comparable sessions as the latest result:

```
selectedPeriodChangePct = 100 * (latestMedian / baselineMedian - 1)
```

Small endpoint groups protect the result from one unusually good or poor
session while still answering the intuitive question: “Have I made progress
from the beginning of this period to now?” The displayed lift trend is a
cross-check: a visibly upward trend must not be labelled a plateau merely
because two adjacent short blocks happen to have the same median.

- **Insufficient comparable data:** shared performance gate not met.
- **No plateau signal:** selected-period change is greater than +1.5%, or the
  fitted trend across comparable observations is clearly upward.
- **Watch:** selected-period change is between -1.5% and +1.5%, but endpoint
  or trend evidence is mixed.
- **Likely plateau:** selected-period change is within +/-1.5% *and* the
  fitted trend is effectively flat across the selected period, with at least
  six comparable sessions spread across six weeks.

“Effectively flat” initially means that the trendline's predicted change from
the first to last comparable session is also within +/-1.5%. A robust linear
fit or Theil-Sen slope is preferable to ordinary least squares because one
exceptional session should not control the result. The exact fit remains an
implementation choice, but its predicted start-to-end change must be shown in
the evidence.

Suppress or downgrade a plateau signal when there was a long training gap,
recent deload, a rep-range change, or at least a 25% relevant direct-volume or
frequency change. These factors can explain a temporary result and make a
stable comparison less meaningful.

For example: “No plateau signal — session-best estimated 1RM rose 4.1% from
the first to the latest comparable observations; the selected-period trend is
upward.” This replaces wording such as “0% median recent change,” which only
describes two adjacent short blocks and can contradict the visible trend.

The next-step language depends on the other measures: high recovery plus low
exposure can justify a single small experiment; low recovery supports holding
or reducing demand before adding work; a recent program change supports
waiting until the setup is stable enough to evaluate.

## Recovery score — whole program

### Naming and limitation

The import cannot observe sleep, nutrition, stress, soreness, injury, or true
physiological recovery. The UI should call this **Performance stability
(recovery proxy)** and must not present it as a medical or recovery diagnosis.

### Calculation

For every adjacent pair of comparable session-best observations of an exercise:

```
successfulRepeat = currentEstimated1RM >= 0.98 * priorEstimated1RM
score = 100 * weightedSuccessfulRepeats / weightedComparableRepeats
```

The 2% tolerance recognizes ordinary measurement and day-to-day variability.
Weight repeated exercise evidence more highly than isolated observations, and
exclude pairs separated by unusually long gaps. Show the numerator and
denominator, for example: “72 — 18 of 25 comparable repeats matched the prior
performance within 2%.”

| Score | Interpretation |
| --- | --- |
| 85–100 | Performance is usually maintained |
| 70–84 | Mixed performance stability |
| Below 70 | Repeated underperformance worth reviewing |

RPE, when present, may be shown as context (for example, a performance drop
alongside rising RPE), but is not converted into a recovery diagnosis.

## Presentation and revision protocol

Each card should contain the score/status, a one-sentence interpretation, the
specific evidence used, confidence, exclusions, and a conditional next action.
Do not hide calculation components behind one opaque number.

When changing a formula or threshold:

1. Record the date, prior and new rule, reason, and expected user impact here.
2. Version the implementation rules separately from historical displayed
   results, so recalculation is explainable.
3. Test score distributions and false-positive examples using representative
   exports before release.
4. Re-evaluate all fixed anchors as product heuristics, not medical guidance or
   universal training prescriptions.

## First-version implementation decisions

- Comparable recovery transitions are limited to a maximum 28-day gap.
- Recovery transitions receive one vote each, which naturally gives repeated
  exercise evidence more weight without multiplying it by set count.
- Because the app has no goal questionnaire, low exposure is described as a
  review opportunity and never as a deficit or automatic reason to add volume.
- Validate Epley-estimate behavior at the rep ranges commonly logged by users.
- The Insights plateau cross-check uses the Theil-Sen median pairwise slope,
  expressed as predicted first-to-last percentage change. Revisit it with
  representative exports before treating it as a permanent choice.
- Establish a changelog section below when the first rule revision occurs.

## Change log

- 2026-09-18: Implemented the initial rules with a 28-day comparison-gap cap,
  eight-pair minimum for the recovery proxy, and complete-week gating for
  weekly scores.
- 2026-09-18: Added the user-facing Info page, with adjustable thresholds read
  directly from the centralized Insights and Coach rule files.
- 2026-09-18: Added automatic Strong/Hevy import detection and excluded Hevy
  sets explicitly marked as warm-ups from working-set measures.
- 2026-09-18: Changed the Opportunity score's volume component from direct
  sets to weighted total sets (direct + half indirect).
- 2026-09-18: Changed plateau detection from adjacent recent-block comparison
  to selected-period start-to-latest comparison, with a robust trend
  cross-check. A rising trend can have two adjacent medians that are equal, so
  plateau language must not mislabel that situation as flat.
- 2026-09-18: Implemented the revised plateau rule on Insights and Coach. The
  Insights cross-check uses a Theil-Sen median pairwise slope; Coach now
  describes its first-to-latest comparison instead of a recent-block result.
