# Gym Progress

A beginner-friendly workout tracker built step by step with HTML, CSS, and JavaScript.

## Run it locally

Open `index.html` in a web browser.

## Current milestone

The app will import a Strong CSV export and analyse the logged sets. The
`exercise-muscles.js` file maps each exercise name in the supplied export to
its primary and secondary muscle groups. We will use this mapping when we add
the CSV importer.

## Importing a Strong export

Open `index.html`, select a Strong CSV, and inspect the import summary. The
file is parsed in the browser only; this first version does not upload or save
the data. The page lists exercises that do not have an entry in
`exercise-muscles.js`.

## Hard-set volume

After importing, the dashboard counts one direct hard set for every primary
muscle mapped to an exercise. A compound movement can therefore contribute one
set to more than one muscle group. This is intentional: muscle-group totals
are separate measures, not pieces of one whole-body total.

## Estimated 1RM trends

The separate `trends.html` page lets you select any imported Strong exercise
and choose the start and end dates for its trend period. It displays lift-workout
frequency and direct hard-set volume for the selected lift's mapped primary and
secondary muscles. The chart uses the highest Epley estimate in each week,
while the bottom table summarises the entire selected period:
`weight × (1 + reps ÷ 30)`.

Muscle columns in the selected-period table show the average number of direct
hard sets per week. Hovering or keyboard-focusing a chart point reveals the
week and its calculated estimated 1RM.

The imported rows are saved in this browser's local storage so the trends page
and Dashboard can use them without another upload. They are not sent to a
server or committed to Git.

## Volume

The `volume.html` page reports sessions, direct and weighted-total muscle
volume, and a deload check for a selected period. Weighted-total volume counts
direct sets as 1 and
indirect sets as 0.5. The deload check is a configurable heuristic: a completed
Monday–Sunday week with logged training at or below 50% of the preceding four
completed weeks' average direct hard-set count.

The Volume muscle metrics also display direct and total averages per week.
Notable estimated-1RM PRs appear on Lift trends and link to the selected
exercise chart while preserving the current date range.

The Volume view uses an interactive weekly line chart. Choose one or more
muscle groups and direct or total sets to compare in the selected Volume period.
Each selected muscle has a
different colour and every data point reveals its value on hover or focus.

The same chart can also show muscle-group training frequency: the number of
workout sessions per week in which a muscle received a logged direct or
indirect set.

The Volume page includes an interactive front-and-back body map. Its colour
intensity and hover values show average total sets per week for the selected
period.

Volume also provides quick period controls for the last 4 weeks, last 12
weeks, last 6 months, last year, and all imported data.

These quick period controls, including All time, are shared with Lift trends so
future pages can use the same consistent period-selection behaviour.

## Coach

The `coach.html` page automatically reviews the latest 12 weeks ending on the
latest imported workout date. It uses documented deterministic rules in
`coach-rules.js` to identify supported consistency, progression, possible
plateau, and volume patterns. It never infers a goal, planned schedule, effort,
recovery, fatigue, injury, or a universal required volume target from the log.
All review thresholds, sample-size requirements, and confidence cut-offs are
centralized in `coach-rules.js` so they can be reviewed and adjusted later.

## Metric definitions

In this app, **volume** means the number of logged hard sets. We assume that
every imported working set was performed sufficiently close to failure to
count. We do not use weight multiplied by reps (tonnage) as the volume metric.

A set counts as one direct set for each primary muscle listed for its exercise.
For example, one barbell bench-press set counts as one chest set. Secondary
muscles are reported separately as indirect/contributing sets, so they are not
silently mixed with direct chest, triceps, or shoulder work.
