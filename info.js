"use strict";

const infoRuleValues = {
  comparableReps: insightRules.comparableRepDifference,
  consistencyScale: insightRules.consistencyDeviationScale,
  consistencyWeeks: insightRules.minimumCompleteWeeksForConsistency,
  volumePoints: insightRules.opportunityVolumePoints,
  volumeAnchor: insightRules.opportunityVolumeReviewAnchor,
  frequencyPoints: insightRules.opportunityFrequencyPoints,
  frequencyAnchor: insightRules.opportunityFrequencyReviewAnchor,
  stabilityPoints: insightRules.opportunityStabilityPoints,
  stabilityAnchor: insightRules.opportunityStabilityAnchor,
  recoveryTolerance: insightRules.recoveryTolerancePercent,
  recoveryToleranceDecimal: (insightRules.recoveryTolerancePercent / 100).toFixed(2),
  recoveryPairs: insightRules.recoveryMinimumComparablePairs,
  recoveryGap: insightRules.recoveryMaximumGapDays,
  efficiencyFloor: insightRules.efficiencySetFloor,
  efficiencyNeutral: insightRules.efficiencyNeutralScore,
  efficiencyScale: insightRules.efficiencyScale,
  performanceSessions: insightRules.minimumPerformanceSessions,
  performanceWeeks: insightRules.minimumPerformanceWeeks,
  plateauTolerance: insightRules.plateauTolerancePercent,
  plateauDowngrade: insightRules.plateauChangeDowngradePercent,
  coachWeeks: coachRules.reviewDays / 7,
  regularityWeeks: coachRules.minimumWeeksForRegularity,
  activeWeekShare: Math.round(coachRules.minimumActiveWeekShare * 100),
  coachPerformanceSessions: coachRules.minimumSessionsForLiftSignal,
  coachPerformanceWeeks: coachRules.minimumWeeksForLiftSignal,
  progressionPercent: coachRules.progressionPercent,
  loadIncreasePercent: coachRules.meaningfulLoadIncreasePercent,
  coachPlateau: coachRules.plateauPercent,
  comparisonWeeks: coachRules.comparisonDays / 7,
  frequencyReduction: coachRules.frequencyReductionPercent,
  volumeChange: coachRules.volumeChangePercent,
  highConfidenceWeeks: coachRules.highConfidenceMinimumWeeks,
  highConfidenceSessions: coachRules.highConfidenceMinimumSessions,
  mediumConfidenceWeeks: coachRules.mediumConfidenceMinimumWeeks,
  mediumConfidenceSessions: coachRules.mediumConfidenceMinimumSessions,
};

for (const element of document.querySelectorAll("[data-info-rule]")) {
  const value = infoRuleValues[element.dataset.infoRule];
  element.textContent = value ?? "—";
}

document.querySelector("#measure-doc-version").textContent = insightRules.documentationVersion;
