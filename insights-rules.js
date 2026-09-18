"use strict";

// First-version insight rules. These are transparent product heuristics, not
// universal training targets or medical/recovery claims.
// When a measure changes, update info.html, docs/insight-measures.md, the
// documentationVersion below, and the change log in the specification.
const insightRules = Object.freeze({
  documentationVersion: "2026-09-18",
  defaultPeriodDays: 84,
  minimumCompleteWeeksForConsistency: 4,
  consistencyDeviationScale: 0.75,
  minimumPerformanceSessions: 6,
  minimumPerformanceWeeks: 6,
  comparableRepDifference: 3,
  efficiencySetFloor: 2,
  efficiencyNeutralScore: 50,
  efficiencyScale: 25,
  opportunityVolumeReviewAnchor: 5,
  opportunityFrequencyReviewAnchor: 2,
  opportunityVolumePoints: 40,
  opportunityFrequencyPoints: 30,
  opportunityStabilityPoints: 30,
  opportunityStabilityAnchor: 80,
  recoveryMinimumComparablePairs: 8,
  recoveryTolerancePercent: 2,
  recoveryMaximumGapDays: 28,
  plateauTolerancePercent: 1.5,
  plateauChangeDowngradePercent: 25,
});
