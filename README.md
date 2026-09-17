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

## Summary

The `summary.html` page reports sessions, direct and weighted-total muscle
volume, a four-week volume comparison, estimated-1RM PRs, and a deload check
for a selected period. Weighted-total volume counts direct sets as 1 and
indirect sets as 0.5. The deload check is a configurable heuristic: a completed
Monday–Sunday week with logged training at or below 50% of the preceding four
completed weeks' average direct hard-set count.

The Summary four-week comparison is always available: it compares the four
weeks ending on the selected end date with the preceding four weeks, even when
those dates begin before the selected Summary range.

The Summary muscle-volume table also displays direct and total averages per
week. Each estimated-1RM PR links to the selected exercise on the Lift trends
page, carrying the selected Summary date range with it.

The Summary page includes an interactive front-and-back body map. Its colour
intensity and hover values show average total sets per week for the selected
period.

Summary also provides quick period controls for the last 4 weeks, last 12
weeks, last 6 months, and last year of the imported data.

These quick period controls are shared with Lift trends so future pages can use
the same consistent period-selection behaviour.

## Metric definitions

In this app, **volume** means the number of logged hard sets. We assume that
every imported working set was performed sufficiently close to failure to
count. We do not use weight multiplied by reps (tonnage) as the volume metric.

A set counts as one direct set for each primary muscle listed for its exercise.
For example, one barbell bench-press set counts as one chest set. Secondary
muscles are reported separately as indirect/contributing sets, so they are not
silently mixed with direct chest, triceps, or shoulder work.
