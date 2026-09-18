"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const defaultCsvName = fs.readdirSync(projectRoot).find((name) => name.toLowerCase().endsWith(".csv"));
const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCsvName && path.join(projectRoot, defaultCsvName);
if (!csvPath) throw new Error("No workout CSV is available for the Insights smoke test.");

const dummyElement = () => ({
  hidden: true,
  value: "",
  min: "",
  max: "",
  options: [],
  selectedOptions: [],
  style: { setProperty() {} },
  addEventListener() {},
  append() {},
  replaceChildren() {},
  setAttribute() {},
});

const sandbox = {
  console,
  URL,
  Intl,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: {
    querySelector() { return dummyElement(); },
    querySelectorAll() { return []; },
    createElement() { return dummyElement(); },
    createElementNS() { return dummyElement(); },
  },
  window: { location: { href: "file:///insights.html" } },
  __csvText: fs.readFileSync(csvPath, "utf8"),
};

const sources = ["data.js", "exercise-muscles.js", "insights-rules.js", "insights.js"]
  .map((name) => fs.readFileSync(path.join(projectRoot, name), "utf8"))
  .join("\n");

const assertions = `
  const smokeRows = parseWorkoutCsv(__csvText);
  const smokeDates = smokeRows.map((row) => row.Date.slice(0, 10)).sort();
  const smokeEnd = smokeDates.at(-1);
  const smokeStart = [smokeDates[0], addInsightDays(smokeEnd, -83)].sort().at(-1);
  const smokeWeeks = getCompleteInsightWeeks(smokeStart, smokeEnd);
  const smokeWeekSet = new Set(smokeWeeks);
  const smokePeriodRows = smokeRows.filter((row) => isInInsightPeriod(row.Date, smokeStart, smokeEnd));
  const smokeCompleteRows = smokePeriodRows.filter((row) => smokeWeekSet.has(getInsightWeekStart(row.Date)));
  const smokeWeekly = getWeeklyActivity(smokeCompleteRows, smokeWeeks);
  const smokeConsistency = getConsistencyScore(smokeWeekly);
  const smokeRecovery = getRecoveryScore(smokeCompleteRows);
  const smokeMuscles = getMuscleMeasures(smokeCompleteRows, smokeWeeks.length, smokeRecovery);
  const smokeOpportunities = smokeMuscles.filter((muscle) => muscle.opportunity !== null);
  const smokeEfficiencies = getExerciseEfficiencies(smokeCompleteRows, smokeWeeks.length);
  const smokePlateaus = getPlateauSignals(smokeCompleteRows);
  if (smokePeriodRows.length === 0) throw new Error("Review period contains no rows.");
  if (smokeWeeks.length === 0) throw new Error("Review period contains no complete weeks.");
  if (smokeWeekly.some((week) => !Number.isFinite(week.sessions) || !Number.isFinite(week.sets))) throw new Error("Weekly activity contains a non-finite value.");
  if (smokeConsistency.available && !Number.isFinite(smokeConsistency.score)) throw new Error("Consistency score is invalid.");
  if (smokeRecovery.available && !Number.isFinite(smokeRecovery.score)) throw new Error("Recovery score is invalid.");
  if (smokeMuscles.some((muscle) => !Number.isFinite(muscle.totalPerWeek))) throw new Error("Muscle volume contains a non-finite value.");
  if (smokeOpportunities.some((muscle) => !Number.isFinite(muscle.opportunity))) throw new Error("Opportunity score is invalid.");
  const indirectOnlyRows = [{ "Workout #": "1", Date: "2026-09-14 12:00:00", "Exercise Name": "Bench Press (Barbell)", "Weight (kg)": "100", Reps: "5" }];
  const indirectTriceps = getMuscleMeasures(indirectOnlyRows, 1, { available: true, score: 80 }).find((muscle) => muscle.muscle === "triceps");
  const expectedTotalVolumePoints = insightRules.opportunityVolumePoints * (insightRules.opportunityVolumeReviewAnchor - 0.5) / insightRules.opportunityVolumeReviewAnchor;
  if (Math.abs(indirectTriceps.volumePoints - expectedTotalVolumePoints) > 0.0001) throw new Error("Opportunity volume does not use weighted total sets.");
  if (smokeEfficiencies.some((item) => !Number.isFinite(item.score))) throw new Error("Efficiency contains a non-finite value.");
  console.log(JSON.stringify({ rows: smokePeriodRows.length, completeWeeks: smokeWeeks.length, consistency: smokeConsistency.score, recovery: smokeRecovery.score, muscles: smokeMuscles.length, efficiencies: smokeEfficiencies.length, plateaus: smokePlateaus.length }));
`;

vm.runInNewContext(`${sources}\n${assertions}`, sandbox, { filename: "insights-smoke.vm.js" });
