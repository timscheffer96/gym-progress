"use strict";

const coachContent = document.querySelector("#coach-content");
const coachNoImport = document.querySelector("#coach-no-import");
const coachPeriod = document.querySelector("#coach-period");
const coachOverallText = document.querySelector("#coach-overall-text");
const coachPositives = document.querySelector("#coach-positives");
const coachOpportunities = document.querySelector("#coach-opportunities");
const coachLimits = document.querySelector("#coach-limits");
const coachLimitsList = document.querySelector("#coach-limits-list");

renderCoach();

function renderCoach() {
  const rows = loadImportedRows();
  if (rows.length === 0) {
    coachNoImport.hidden = false;
    return;
  }

  const period = getCoachPeriod(rows);
  const reviewRows = rows.filter((row) => isInCoachPeriod(row.Date, period.start, period.end));
  const weeklyRecords = getCoachWeeks(reviewRows, period);
  const frequency = getFrequencyMetrics(reviewRows, weeklyRecords, period);
  const lifts = getLiftSignals(reviewRows);
  const volumeComparison = getVolumeComparison(rows, period);
  const limits = getDataLimits(rows, reviewRows, period);
  const positives = getPositiveInsights(frequency, lifts, period);
  const opportunities = getOpportunityInsights(frequency, lifts, volumeComparison, period);

  coachPeriod.textContent = `Review period: ${period.start} to ${period.end} · Data through ${period.end}.`;
  if (period.availableDays < coachRules.reviewDays) {
    coachPeriod.textContent += ` ${formatWeeks(period.availableDays)} of history is available, so conclusions are preliminary.`;
  }

  renderInsightGroup(coachPositives, positives, "No strong positive pattern met the evidence threshold in this period yet.");
  renderInsightGroup(coachOpportunities, opportunities, "No clear priority emerged from the imported data. Keep logging consistently so future reviews can be more specific.");
  renderLimits(limits);
  coachOverallText.textContent = getOverallAssessment(period, frequency, positives, opportunities);
  coachContent.hidden = false;
}

function getCoachPeriod(rows) {
  const dates = rows.map((row) => row.Date?.slice(0, 10)).filter(Boolean).sort();
  const end = dates.at(-1);
  const earliest = dates[0];
  const proposedStart = addCoachDays(end, -(coachRules.reviewDays - 1));
  const start = [earliest, proposedStart].sort().at(-1);
  return { start, end, availableDays: inclusiveDays(start, end) };
}

function getCoachWeeks(rows, period) {
  const firstWeek = getCoachWeekStart(period.start);
  const lastWeek = getCoachWeekStart(period.end);
  const weeks = [];
  const cursor = new Date(`${firstWeek}T12:00:00`);

  while (cursor.toISOString().slice(0, 10) <= lastWeek) {
    const weekStart = cursor.toISOString().slice(0, 10);
    const weekEnd = addCoachDays(weekStart, 6);
    const observedStart = [weekStart, period.start].sort().at(-1);
    const observedEnd = [weekEnd, period.end].sort()[0];
    weeks.push({ weekStart, observedDays: inclusiveDays(observedStart, observedEnd), sessions: new Set() });
    cursor.setDate(cursor.getDate() + 7);
  }

  const byWeek = new Map(weeks.map((week) => [week.weekStart, week]));
  for (const row of rows) {
    byWeek.get(getCoachWeekStart(row.Date))?.sessions.add(`${row.Date}-${row["Workout #"]}`);
  }

  return weeks.map((week) => ({ ...week, count: week.sessions.size, weeklyRate: week.sessions.size * 7 / week.observedDays }));
}

function getFrequencyMetrics(rows, weeks, period) {
  const sessions = new Set(rows.map((row) => `${row.Date}-${row["Workout #"]}`));
  const activeWeeks = weeks.filter((week) => week.count > 0).length;
  const recentAndEarlier = getRecentAndEarlierRows(rows, period);
  const earlierRate = sessionRate(recentAndEarlier.earlierRows, recentAndEarlier.earlierDays);
  const recentRate = sessionRate(recentAndEarlier.recentRows, recentAndEarlier.recentDays);
  const longestGap = getLongestGap(rows);
  return {
    totalSessions: sessions.size,
    activeWeeks,
    coveredWeeks: weeks.length,
    activeShare: weeks.length === 0 ? 0 : activeWeeks / weeks.length,
    recentRate,
    earlierRate,
    hasComparableBlocks: recentAndEarlier.earlierDays === coachRules.comparisonDays,
    longestGap,
  };
}

function getLiftSignals(rows) {
  const sessionsByLift = new Map();
  for (const row of rows) {
    const estimate = getEstimatedOneRm(row);
    if (estimate === null) continue;
    const exercise = row["Exercise Name"].trim();
    const sessionKey = `${row.Date}-${row["Workout #"]}`;
    if (!sessionsByLift.has(exercise)) sessionsByLift.set(exercise, new Map());
    const current = sessionsByLift.get(exercise).get(sessionKey);
    if (!current || estimate > current.estimate) {
      sessionsByLift.get(exercise).set(sessionKey, { date: row.Date.slice(0, 10), estimate, reps: Number(row.Reps), weight: Number(row["Weight (kg)"]) });
    }
  }

  return [...sessionsByLift.entries()].map(([exercise, sessionMap]) => {
    const sessions = [...sessionMap.values()].sort((first, second) => first.date.localeCompare(second.date));
    const weeks = new Set(sessions.map((session) => getCoachWeekStart(session.date)));
    const window = Math.min(3, Math.floor(sessions.length / 2));
    const early = sessions.slice(0, window);
    const recent = sessions.slice(-window);
    const preceding = sessions.slice(-window * 2, -window);
    const earlyEstimate = median(early.map((session) => session.estimate));
    const recentEstimate = median(recent.map((session) => session.estimate));
    const precedingEstimate = median(preceding.map((session) => session.estimate));
    const earlyReps = median(early.map((session) => session.reps));
    const recentReps = median(recent.map((session) => session.reps));
    const precedingReps = median(preceding.map((session) => session.reps));
    const earlyWeight = median(early.map((session) => session.weight));
    const recentWeight = median(recent.map((session) => session.weight));
    const precedingWeight = median(preceding.map((session) => session.weight));
    const comparable = Math.abs(recentReps - earlyReps) <= coachRules.comparableRepDifference;
    const recentComparable = Math.abs(recentReps - precedingReps) <= coachRules.comparableRepDifference;
    const progressionPercent = earlyEstimate > 0 ? (recentEstimate - earlyEstimate) / earlyEstimate * 100 : 0;
    const recentChangePercent = precedingEstimate > 0 ? (recentEstimate - precedingEstimate) / precedingEstimate * 100 : 0;
    const improvedReps = recentReps >= earlyReps + coachRules.meaningfulRepIncrease && Math.abs(recentWeight - earlyWeight) / earlyWeight * 100 <= coachRules.meaningfulLoadIncreasePercent;
    const improvedLoad = recentWeight >= earlyWeight * (1 + coachRules.meaningfulLoadIncreasePercent / 100) && comparable;
    const recentImprovedReps = recentReps >= precedingReps + coachRules.meaningfulRepIncrease && Math.abs(recentWeight - precedingWeight) / precedingWeight * 100 <= coachRules.meaningfulLoadIncreasePercent;
    const recentImprovedLoad = recentWeight >= precedingWeight * (1 + coachRules.meaningfulLoadIncreasePercent / 100) && recentComparable;
    const enoughData = sessions.length >= coachRules.minimumSessionsForLiftSignal && weeks.size >= coachRules.minimumWeeksForLiftSignal;
    return {
      exercise, sessions, weeks: weeks.size, earlyEstimate, recentEstimate, earlyReps, recentReps, earlyWeight, recentWeight, progressionPercent,
      recentChangePercent, comparable, recentComparable, enoughData,
      progressing: enoughData && comparable && (progressionPercent >= coachRules.progressionPercent || improvedReps || improvedLoad),
      possiblePlateau: enoughData && comparable && recentComparable && Math.abs(recentChangePercent) <= coachRules.plateauPercent && !recentImprovedReps && !recentImprovedLoad,
    };
  });
}

function getVolumeComparison(rows, period) {
  const blocks = getRecentAndEarlierRows(rows, period);
  if (blocks.earlierDays < coachRules.comparisonDays || blocks.recentDays < coachRules.comparisonDays) return null;
  const earlier = getCoachVolume(blocks.earlierRows);
  const recent = getCoachVolume(blocks.recentRows);
  const muscles = [...new Set([...earlier.keys(), ...recent.keys()])];
  const changes = new Map(muscles.map((muscle) => {
    const previous = earlier.get(muscle) ?? { direct: 0, total: 0 };
    const current = recent.get(muscle) ?? { direct: 0, total: 0 };
    const percent = previous.direct > 0 ? (current.direct - previous.direct) / previous.direct * 100 : null;
    return [muscle, { earlier: previous, recent: current, percent }];
  }));
  return { ...blocks, changes };
}

function getPositiveInsights(frequency, lifts, period) {
  const insights = [];
  if (frequency.coveredWeeks >= coachRules.minimumWeeksForRegularity && frequency.activeShare >= coachRules.minimumActiveWeekShare && (!frequency.hasComparableBlocks || frequency.recentRate >= frequency.earlierRate * 0.85)) {
    insights.push(createInsight({
      headline: "Regular training has been sustained",
      numbers: `${frequency.totalSessions} logged sessions across ${frequency.coveredWeeks} calendar weeks; activity appeared in ${frequency.activeWeeks} weeks.`,
      why: "A repeated training pattern gives performance trends more meaning than isolated workouts.",
      next: "Continue the current rhythm and keep logging comparable sets so the next review can confirm the trend.",
      confidence: getConfidence(frequency.coveredWeeks, frequency.totalSessions),
      evidence: `Weekly logged-session rates were reviewed, including partial weeks. Longest gap between logged workout dates: ${frequency.longestGap} days.`,
      link: getVolumeLink(period),
      linkText: "Open Volume",
    }));
  }

  const progressing = lifts.filter((lift) => lift.progressing).sort((first, second) => second.progressionPercent - first.progressionPercent).slice(0, 2);
  for (const lift of progressing) {
    insights.push(createInsight({
      headline: `${lift.exercise} performance is trending up`,
      numbers: `Median workout-best estimated 1RM moved from ${lift.earlyEstimate.toFixed(1)} kg to ${lift.recentEstimate.toFixed(1)} kg (${formatSigned(lift.progressionPercent)}%). The comparable median observation changed from ${lift.earlyWeight.toFixed(1)} kg × ${lift.earlyReps.toFixed(1)} to ${lift.recentWeight.toFixed(1)} kg × ${lift.recentReps.toFixed(1)} reps across ${lift.sessions.length} sessions in ${lift.weeks} weeks.`,
      why: "The signal comes from repeated workout observations at reasonably similar rep ranges, so it is stronger than a single exceptional set.",
      next: "Continue the current approach for this lift and keep the exercise and rep range comparable when you want to judge progress.",
      confidence: getConfidence(lift.weeks, lift.sessions.length),
      evidence: `Comparison uses the median of the first and most recent ${Math.min(3, Math.floor(lift.sessions.length / 2))} workout-best estimates. Median reps differed by no more than ${coachRules.comparableRepDifference}.`,
      link: getTrendLink(lift.exercise, period),
      linkText: "Open Lift trends",
    }));
  }
  return insights.slice(0, 3);
}

function getOpportunityInsights(frequency, lifts, volumeComparison, period) {
  const insights = [];
  const relatedMuscles = new Set();
  const plateaus = lifts.filter((lift) => lift.possiblePlateau).sort((first, second) => Math.abs(first.recentChangePercent) - Math.abs(second.recentChangePercent));
  const frequencyReduced = frequency.hasComparableBlocks && frequency.earlierRate > 0 && frequency.recentRate < frequency.earlierRate * (1 - coachRules.frequencyReductionPercent / 100);

  if (frequencyReduced) {
    const plateau = plateaus[0];
    insights.push(createInsight({
      headline: plateau ? "Restore a manageable training rhythm before changing volume" : "Logged training frequency has recently reduced",
      numbers: `Logged frequency changed from ${frequency.earlierRate.toFixed(1)} to ${frequency.recentRate.toFixed(1)} sessions per week across two comparable 4-week blocks.${plateau ? ` ${plateau.exercise} also showed little recent estimated-1RM change (${formatSigned(plateau.recentChangePercent)}%).` : ""}`,
      why: "A change in logged exposure makes it difficult to judge whether a flat performance trend reflects the lift, the routine, or both.",
      next: "First review whether the recent logged frequency reflects your current plan. If you want to change it, try one manageable adjustment before adding more sets.",
      confidence: getConfidence(8, frequency.totalSessions),
      evidence: "This compares actual logged sessions per week; it does not assume a planned schedule or treat unlogged days as missed sessions.",
      link: getVolumeLink(period),
      linkText: "Open Volume",
      priority: true,
    }));
  }

  if (!frequencyReduced && plateaus.length > 0) {
    const lift = plateaus[0];
    const volumeContext = getLiftVolumeContext(lift.exercise, volumeComparison);
    if (volumeContext) relatedMuscles.add(volumeContext.muscle);
    const volumePhrase = volumeContext ? ` Direct ${volumeContext.muscle} volume changed from ${volumeContext.earlier.toFixed(1)} to ${volumeContext.recent.toFixed(1)} sets per week (${formatSigned(volumeContext.percent)}%).` : "";
    insights.push(createInsight({
      headline: `Possible plateau on ${lift.exercise}`,
      numbers: `Across ${lift.sessions.length} sessions in ${lift.weeks} weeks, median recent estimated 1RM changed ${formatSigned(lift.recentChangePercent)}% versus the preceding comparable observations. Median load and reps moved from ${lift.earlyWeight.toFixed(1)} kg × ${lift.earlyReps.toFixed(1)} to ${lift.recentWeight.toFixed(1)} kg × ${lift.recentReps.toFixed(1)} reps across the review.${volumePhrase}`,
      why: "Performance was checked through load, reps, and estimated 1RM across repeated sessions. This is a possible plateau, not a confirmed diagnosis.",
      next: volumeContext && volumeContext.percent >= coachRules.volumeChangePercent ? "Review whether the extra sets are helping. Keep frequency steady and change only one small variable for a few weeks before judging the result." : "Keep logging comparable sessions. If you experiment, change one small training variable at a time rather than assuming more volume is the answer.",
      confidence: getConfidence(lift.weeks, lift.sessions.length),
      evidence: `Requires at least ${coachRules.minimumSessionsForLiftSignal} sessions spread over ${coachRules.minimumWeeksForLiftSignal} weeks, with median reps within ${coachRules.comparableRepDifference}.`,
      link: getTrendLink(lift.exercise, period),
      linkText: "Open Lift trends",
      priority: true,
    }));
  }

  if (!frequencyReduced && volumeComparison) {
    const change = [...volumeComparison.changes.entries()]
      .filter(([muscle, value]) => !relatedMuscles.has(muscle) && value.percent !== null && Math.abs(value.percent) >= coachRules.volumeChangePercent)
      .sort(([, first], [, second]) => Math.abs(second.percent) - Math.abs(first.percent))[0];
    if (change && insights.length < 3) {
      const [muscle, value] = change;
      insights.push(createInsight({
        headline: `${muscle} exposure has changed noticeably`,
        numbers: `Direct ${muscle} sets changed from ${(value.earlier.direct / 4).toFixed(1)} to ${(value.recent.direct / 4).toFixed(1)} per week (${formatSigned(value.percent)}%). Weighted total sets (direct + half indirect) changed from ${(value.earlier.total / 4).toFixed(1)} to ${(value.recent.total / 4).toFixed(1)} per week across the last two 4-week blocks.`,
        why: "A meaningful change in logged exposure is worth checking against performance, especially when you are deciding whether the change was useful.",
        next: "Review whether this change was intentional and whether the relevant lift trend moved with it. Treat any adjustment as a small experiment, not a certain fix.",
        confidence: "Medium",
        evidence: "Direct sets and weighted total sets are shown separately; total means direct sets plus half of indirect sets.",
        link: getVolumeLink(period),
        linkText: "Open Volume",
      }));
    }
  }
  return insights.slice(0, 3);
}

function getLiftVolumeContext(exercise, volumeComparison) {
  if (!volumeComparison || !exerciseMuscles[exercise]) return null;
  const muscle = exerciseMuscles[exercise].primary[0];
  const change = volumeComparison.changes.get(muscle);
  if (!change || change.percent === null) return null;
  return { muscle, earlier: change.earlier.direct / 4, recent: change.recent.direct / 4, percent: change.percent };
}

function getCoachVolume(rows) {
  const volume = new Map();
  for (const row of rows) {
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];
    if (!mapping) continue;
    for (const muscle of mapping.primary) {
      const counts = volume.get(muscle) ?? { direct: 0, total: 0 };
      counts.direct += 1;
      counts.total += 1;
      volume.set(muscle, counts);
    }
    for (const muscle of mapping.secondary) {
      const counts = volume.get(muscle) ?? { direct: 0, total: 0 };
      counts.total += 0.5;
      volume.set(muscle, counts);
    }
  }
  return volume;
}

function getRecentAndEarlierRows(rows, period) {
  const recentStart = addCoachDays(period.end, -(coachRules.comparisonDays - 1));
  const earlierEnd = addCoachDays(recentStart, -1);
  const earlierStart = addCoachDays(earlierEnd, -(coachRules.comparisonDays - 1));
  const recentStartBounded = [period.start, recentStart].sort().at(-1);
  const earlierStartBounded = [period.start, earlierStart].sort().at(-1);
  return {
    recentRows: rows.filter((row) => isInCoachPeriod(row.Date, recentStartBounded, period.end)),
    earlierRows: rows.filter((row) => isInCoachPeriod(row.Date, earlierStartBounded, earlierEnd)),
    recentDays: inclusiveDays(recentStartBounded, period.end),
    earlierDays: earlierEnd < period.start ? 0 : inclusiveDays(earlierStartBounded, earlierEnd),
  };
}

function getDataLimits(allRows, reviewRows, period) {
  const limits = [];
  if (period.availableDays < coachRules.reviewDays) limits.push(`Only ${formatWeeks(period.availableDays)} of imported history is available for this review.`);
  const rpeRows = reviewRows.filter((row) => row.RPE?.trim());
  if (rpeRows.length === 0) limits.push("RPE is not logged in this period, so effort and recovery are not assessed.");
  const unmapped = [...new Set(reviewRows.map((row) => row["Exercise Name"].trim()).filter((exercise) => !exerciseMuscles[exercise]))];
  if (unmapped.length > 0) limits.push(`${unmapped.length} exercise${unmapped.length === 1 ? " is" : "s are"} unmapped and excluded from muscle-group volume analysis.`);
  if (allRows.length === 0) limits.push("No usable workout rows were found.");
  return limits;
}

function getOverallAssessment(period, frequency, positives, opportunities) {
  if (period.availableDays < 42) return "This is an early read from limited history. Keep logging comparable workouts before treating any pattern as a firm conclusion.";
  if (opportunities.length === 0 && positives.length > 0) return "The available log shows a stable pattern with positive performance signals. Continue the current approach and keep gathering comparable data.";
  if (opportunities[0]?.priority) return `The clearest pattern is ${opportunities[0].headline.toLowerCase()}. Start there before making broader changes.`;
  if (positives.length > 0) return "The review shows encouraging signals alongside a focused area to keep an eye on.";
  return "The log contains useful training history, but it does not yet support a strong coaching conclusion beyond continued consistent tracking.";
}

function createInsight(values) { return values; }

function renderInsightGroup(container, insights, emptyMessage) {
  container.replaceChildren();
  if (insights.length === 0) {
    const message = document.createElement("p");
    message.className = "coach-empty";
    message.textContent = emptyMessage;
    container.append(message);
    return;
  }
  insights.forEach((insight, index) => container.append(renderInsight(insight, index === 0 && insight.priority)));
}

function renderInsight(insight, emphasized) {
  const card = document.createElement("article");
  card.className = `coach-insight${emphasized ? " coach-insight-priority" : ""}`;
  const heading = document.createElement("h3");
  heading.textContent = insight.headline;
  const numbers = document.createElement("p");
  numbers.className = "coach-numbers";
  numbers.textContent = insight.numbers;
  const why = document.createElement("p");
  why.textContent = insight.why;
  const next = document.createElement("p");
  next.className = "coach-next";
  next.textContent = `Next step: ${insight.next}`;
  const confidence = document.createElement("span");
  confidence.className = "coach-confidence";
  confidence.textContent = `Confidence: ${insight.confidence}`;
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "How we reached this conclusion";
  const evidence = document.createElement("p");
  evidence.textContent = insight.evidence;
  const link = document.createElement("a");
  link.href = insight.link;
  link.textContent = insight.linkText;
  details.append(summary, evidence, link);
  card.append(heading, confidence, numbers, why, next, details);
  return card;
}

function renderLimits(limits) {
  coachLimitsList.replaceChildren();
  if (limits.length === 0) {
    coachLimits.hidden = true;
    return;
  }
  limits.forEach((limit) => {
    const item = document.createElement("li");
    item.textContent = limit;
    coachLimitsList.append(item);
  });
  coachLimits.hidden = false;
}

function getConfidence(weeks, sessions) {
  if (weeks >= coachRules.highConfidenceMinimumWeeks && sessions >= coachRules.highConfidenceMinimumSessions) return "High";
  if (weeks >= coachRules.mediumConfidenceMinimumWeeks && sessions >= coachRules.mediumConfidenceMinimumSessions) return "Medium";
  return "Preliminary";
}

function getTrendLink(exercise, period) {
  const link = new URL("trends.html", window.location.href);
  link.searchParams.set("lift", exercise);
  link.searchParams.set("start", period.start);
  link.searchParams.set("end", period.end);
  return link.toString();
}

function getVolumeLink(period) {
  const link = new URL("volume.html", window.location.href);
  link.searchParams.set("start", period.start);
  link.searchParams.set("end", period.end);
  return link.toString();
}

function getEstimatedOneRm(row) {
  const weight = Number(row["Weight (kg)"]);
  const reps = Number(row.Reps);
  return Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0 ? weight * (1 + reps / 30) : null;
}

function getLongestGap(rows) {
  const dates = [...new Set(rows.map((row) => row.Date.slice(0, 10)))].sort();
  if (dates.length < 2) return 0;
  return Math.max(...dates.slice(1).map((date, index) => inclusiveDays(dates[index], date) - 1));
}

function sessionRate(rows, days) { return days > 0 ? new Set(rows.map((row) => `${row.Date}-${row["Workout #"]}`)).size * 7 / days : 0; }
function median(values) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function getCoachWeekStart(dateTime) { const date = new Date(`${dateTime.slice(0, 10)}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date.toISOString().slice(0, 10); }
function isInCoachPeriod(dateTime, start, end) { const date = dateTime.slice(0, 10); return date >= start && date <= end; }
function addCoachDays(dateString, days) { const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function inclusiveDays(start, end) { return end < start ? 0 : Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86_400_000) + 1; }
function formatWeeks(days) { return `${(days / 7).toFixed(1)} weeks`; }
function formatSigned(value) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`; }
