"use strict";

// Transparent first-version coaching rules. Adjust these in one place as the
// product evolves; they are heuristics, not medical or training prescriptions.
// When a rule changes, update info.html and the relevant README/specification.
const coachRules = Object.freeze({
  reviewDays: 84,
  comparisonDays: 28,
  minimumWeeksForRegularity: 8,
  minimumActiveWeekShare: 0.7,
  minimumSessionsForLiftSignal: 6,
  minimumWeeksForLiftSignal: 6,
  highConfidenceMinimumWeeks: 8,
  highConfidenceMinimumSessions: 8,
  mediumConfidenceMinimumWeeks: 6,
  mediumConfidenceMinimumSessions: 6,
  comparableRepDifference: 3,
  meaningfulRepIncrease: 1,
  meaningfulLoadIncreasePercent: 2.5,
  progressionPercent: 2.5,
  plateauPercent: 1.5,
  frequencyReductionPercent: 25,
  volumeChangePercent: 25,
});
