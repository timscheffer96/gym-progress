# Gym Progress

A beginner-friendly workout tracker built step by step with HTML, CSS, and JavaScript.

## Run it locally

Open `index.html` in a web browser.

## Current milestone

The app will import a Strong CSV export and analyse the logged sets. The
`exercise-muscles.js` file maps each exercise name in the supplied export to
its primary and secondary muscle groups. We will use this mapping when we add
the CSV importer.

## Metric definitions

In this app, **volume** means the number of logged hard sets. We assume that
every imported working set was performed sufficiently close to failure to
count. We do not use weight multiplied by reps (tonnage) as the volume metric.

A set counts as one direct set for each primary muscle listed for its exercise.
For example, one barbell bench-press set counts as one chest set. Secondary
muscles are reported separately as indirect/contributing sets, so they are not
silently mixed with direct chest, triceps, or shoulder work.
