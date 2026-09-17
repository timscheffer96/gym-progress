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

The separate `trends.html` page lets you select any imported Strong exercise.
It displays the latest 12 calendar weeks in the export, lift-workout frequency,
and direct hard-set volume for the selected lift's mapped primary and secondary
muscles. It uses the highest Epley estimate in each week:
`weight × (1 + reps ÷ 30)`.

The imported rows are saved in this browser's local storage so the trends page
can use them without another upload. They are not sent to a server or committed
to Git.

## Metric definitions

In this app, **volume** means the number of logged hard sets. We assume that
every imported working set was performed sufficiently close to failure to
count. We do not use weight multiplied by reps (tonnage) as the volume metric.

A set counts as one direct set for each primary muscle listed for its exercise.
For example, one barbell bench-press set counts as one chest set. Secondary
muscles are reported separately as indirect/contributing sets, so they are not
silently mixed with direct chest, triceps, or shoulder work.
