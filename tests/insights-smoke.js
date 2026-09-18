"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const csvName = fs.readdirSync(projectRoot).find((name) => name.toLowerCase().endsWith(".csv"));
if (!csvName) throw new Error("No ignored Strong CSV is available for the Insights smoke test.");

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
  __csvText: fs.readFileSync(path.join(projectRoot, csvName), "utf8"),
};

const sources = ["data.js", "exercise-muscles.js", "insights-rules.js", "insights.js"]
  .map((name) => fs.readFileSync(path.join(projectRoot, name), "utf8"))
  .join("\n");

const assertions = `
  const smokeRows = parseStrongCsv(__csvText);
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
  if (smokeEfficiencies.some((item) => !Number.isFinite(item.score))) throw new Error("Efficiency contains a non-finite value.");
  console.log(JSON.stringify({ rows: smokePeriodRows.length, completeWeeks: smokeWeeks.length, consistency: smokeConsistency.score, recovery: smokeRecovery.score, muscles: smokeMuscles.length, efficiencies: smokeEfficiencies.length, plateaus: smokePlateaus.length }));
`;

vm.runInNewContext(`${sources}\n${assertions}`, sandbox, { filename: "insights-smoke.vm.js" });
