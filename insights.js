"use strict";

const insightsContent = document.querySelector("#insights-content");
const insightsNoImport = document.querySelector("#insights-no-import");
const insightsStartDate = document.querySelector("#insights-start-date");
const insightsEndDate = document.querySelector("#insights-end-date");
const insightsPeriodStatus = document.querySelector("#insights-period-status");
const insightsDataThrough = document.querySelector("#insights-data-through");
const insightsPresetButtons = document.querySelectorAll("[data-period]");
let insightsRows = [];
let insightsPeriodPresets;

initialiseInsights();

function initialiseInsights() {
  insightsRows = loadImportedRows();
  if (insightsRows.length === 0) {
    insightsNoImport.hidden = false;
    return;
  }

  const dates = insightsRows.map((row) => row.Date?.slice(0, 10)).filter(Boolean).sort();
  const earliestDate = dates[0];
  const latestDate = dates.at(-1);
  for (const input of [insightsStartDate, insightsEndDate]) {
    input.min = earliestDate;
    input.max = latestDate;
  }
  insightsEndDate.value = latestDate;
  insightsStartDate.value = [earliestDate, addInsightDays(latestDate, -(insightRules.defaultPeriodDays - 1))].sort().at(-1);
  insightsStartDate.addEventListener("change", renderInsights);
  insightsEndDate.addEventListener("change", renderInsights);
  insightsPeriodPresets = createPeriodPresetController({
    buttons: insightsPresetButtons,
    startInput: insightsStartDate,
    endInput: insightsEndDate,
    earliestDate,
    latestDate,
    onPeriodChange: renderInsights,
  });
  insightsDataThrough.textContent = `Data through ${formatInsightDate(latestDate)}`;
  insightsContent.hidden = false;
  renderInsights();
}

function renderInsights() {
  const start = insightsStartDate.value;
  const end = insightsEndDate.value;
  if (!start || !end || start > end) {
    insightsPeriodStatus.textContent = "The start date must be on or before the end date.";
    return;
  }

  const period = { start, end, days: inclusiveInsightDays(start, end) };
  const rows = insightsRows.filter((row) => isInInsightPeriod(row.Date, start, end));
  const completeWeeks = getCompleteInsightWeeks(start, end);
  const completeWeekSet = new Set(completeWeeks);
  const completeRows = rows.filter((row) => completeWeekSet.has(getInsightWeekStart(row.Date)));
  const weekly = getWeeklyActivity(completeRows, completeWeeks);
  const previous = getPreviousPeriod(period);
  const consistency = getConsistencyScore(weekly);
  const recovery = getRecoveryScore(completeRows);
  const muscles = getMuscleMeasures(completeRows, completeWeeks.length, recovery);
  const opportunities = muscles.filter((muscle) => muscle.opportunity !== null).sort((a, b) => b.opportunity - a.opportunity);
  const efficiencies = getExerciseEfficiencies(completeRows, completeWeeks.length);
  const plateaus = getPlateauSignals(completeRows);

  insightsPeriodStatus.textContent = `${formatInsightDate(start)} – ${formatInsightDate(end)} · ${formatInsightWeeks(period.days)} selected · ${completeWeeks.length} complete Monday–Sunday week${completeWeeks.length === 1 ? "" : "s"} used for weekly scores.`;
  insightsPeriodPresets?.updateButtonState();
  updateHeadlineCards(rows, previous, weekly, consistency, opportunities[0], recovery);
  renderWeeklyActivity(weekly);
  renderOpportunity(opportunities[0]);
  renderMuscleBars(muscles);
  renderEfficiency(efficiencies, period);
  renderPlateaus(plateaus, period);
  renderLatestWeek(weekly);
  renderCoverage(rows, completeWeeks, recovery, efficiencies);
  updateInsightLinks(period);
}

function getPreviousPeriod(period) {
  const previousEnd = addInsightDays(period.start, -1);
  const previousStart = addInsightDays(previousEnd, -(period.days - 1));
  const earliest = insightsRows.map((row) => row.Date.slice(0, 10)).sort()[0];
  if (previousStart < earliest) return null;
  return insightsRows.filter((row) => isInInsightPeriod(row.Date, previousStart, previousEnd));
}

function getCompleteInsightWeeks(start, end) {
  const weeks = [];
  let cursor = getInsightWeekStart(start);
  if (cursor < start) cursor = addInsightDays(cursor, 7);
  while (addInsightDays(cursor, 6) <= end) {
    weeks.push(cursor);
    cursor = addInsightDays(cursor, 7);
  }
  return weeks;
}

function getWeeklyActivity(rows, weeks) {
  const metrics = new Map(weeks.map((week) => [week, { week, sessions: new Set(), sets: 0 }]));
  for (const row of rows) {
    const metric = metrics.get(getInsightWeekStart(row.Date));
    if (!metric) continue;
    metric.sessions.add(insightSessionKey(row));
    metric.sets += 1;
  }
  return [...metrics.values()].map((metric) => ({ week: metric.week, sessions: metric.sessions.size, sets: metric.sets }));
}

function getConsistencyScore(weekly) {
  if (weekly.length < insightRules.minimumCompleteWeeksForConsistency) return { available: false, score: null, mean: null, deviation: null };
  const values = weekly.map((week) => week.sessions);
  const mean = average(values);
  if (mean === 0) return { available: false, score: null, mean, deviation: null };
  const deviation = average(values.map((value) => Math.abs(value - mean)));
  const score = 100 * clamp(1 - (deviation / Math.max(mean, 1)) / insightRules.consistencyDeviationScale, 0, 1);
  return { available: true, score, mean, deviation };
}

function getRecoveryScore(rows) {
  const exercises = getExerciseSessionObservations(rows);
  const results = [];
  for (const observations of exercises.values()) {
    for (let index = 1; index < observations.length; index += 1) {
      const previous = observations[index - 1];
      const current = observations[index];
      const gap = dateDifference(previous.date, current.date);
      if (gap > insightRules.recoveryMaximumGapDays || Math.abs(current.reps - previous.reps) > insightRules.comparableRepDifference) continue;
      results.push({ success: current.estimate >= previous.estimate * (1 - insightRules.recoveryTolerancePercent / 100), date: current.date });
    }
  }
  const successes = results.filter((result) => result.success).length;
  const available = results.length >= insightRules.recoveryMinimumComparablePairs;
  return { available, score: available ? successes / results.length * 100 : null, successes, comparisons: results.length, sequence: results.map((result) => result.success ? 100 : 0) };
}

function getMuscleMeasures(rows, weeks, recovery) {
  if (weeks === 0) return [];
  const measures = new Map();
  for (const row of rows) {
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];
    if (!mapping) continue;
    const session = insightSessionKey(row);
    for (const muscle of mapping.primary) {
      const value = measures.get(muscle) ?? { muscle, direct: 0, indirect: 0, directSessions: new Set() };
      value.direct += 1;
      value.directSessions.add(session);
      measures.set(muscle, value);
    }
    for (const muscle of mapping.secondary) {
      const value = measures.get(muscle) ?? { muscle, direct: 0, indirect: 0, directSessions: new Set() };
      value.indirect += 1;
      measures.set(muscle, value);
    }
  }
  return [...measures.values()].map((value) => {
    const directPerWeek = value.direct / weeks;
    const totalPerWeek = (value.direct + value.indirect * 0.5) / weeks;
    const frequencyPerWeek = value.directSessions.size / weeks;
    const volumePoints = insightRules.opportunityVolumePoints * clamp((insightRules.opportunityVolumeReviewAnchor - directPerWeek) / insightRules.opportunityVolumeReviewAnchor, 0, 1);
    const frequencyPoints = insightRules.opportunityFrequencyPoints * clamp((insightRules.opportunityFrequencyReviewAnchor - frequencyPerWeek) / insightRules.opportunityFrequencyReviewAnchor, 0, 1);
    const stabilityPoints = recovery.available
      ? insightRules.opportunityStabilityPoints * clamp((insightRules.opportunityStabilityAnchor - recovery.score) / 40, 0, 1)
      : null;
    return { ...value, directPerWeek, totalPerWeek, frequencyPerWeek, volumePoints, frequencyPoints, stabilityPoints, opportunity: stabilityPoints === null ? null : volumePoints + frequencyPoints + stabilityPoints };
  }).sort((a, b) => b.totalPerWeek - a.totalPerWeek);
}

function getExerciseEfficiencies(rows, weeks) {
  if (weeks === 0) return [];
  const observationsByExercise = getExerciseSessionObservations(rows);
  const setsByExercise = new Map();
  for (const row of rows) {
    const exercise = row["Exercise Name"].trim();
    setsByExercise.set(exercise, (setsByExercise.get(exercise) ?? 0) + 1);
  }
  const results = [];
  for (const [exercise, observations] of observationsByExercise) {
    const weekCount = new Set(observations.map((item) => getInsightWeekStart(item.date))).size;
    if (observations.length < insightRules.minimumPerformanceSessions || weekCount < insightRules.minimumPerformanceWeeks) continue;
    const first = observations.slice(0, 3);
    const last = observations.slice(-3);
    const firstReps = median(first.map((item) => item.reps));
    const lastReps = median(last.map((item) => item.reps));
    if (Math.abs(firstReps - lastReps) > insightRules.comparableRepDifference) continue;
    const firstEstimate = median(first.map((item) => item.estimate));
    const lastEstimate = median(last.map((item) => item.estimate));
    const changePercent = (lastEstimate - firstEstimate) / firstEstimate * 100;
    const setsPerWeek = (setsByExercise.get(exercise) ?? 0) / weeks;
    const progressRate = 4 * changePercent / (weeks * Math.max(setsPerWeek, insightRules.efficiencySetFloor));
    const score = clamp(insightRules.efficiencyNeutralScore + insightRules.efficiencyScale * progressRate, 0, 100);
    results.push({ exercise, observations, weekCount, setsPerWeek, changePercent, score });
  }
  return results.sort((a, b) => b.score - a.score);
}

function getPlateauSignals(rows) {
  const observationsByExercise = getExerciseSessionObservations(rows);
  const setCountsByExerciseAndSession = new Map();
  for (const row of rows) {
    const exercise = row["Exercise Name"].trim();
    const key = insightSessionKey(row);
    if (!setCountsByExerciseAndSession.has(exercise)) setCountsByExerciseAndSession.set(exercise, new Map());
    const sessionCounts = setCountsByExerciseAndSession.get(exercise);
    sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
  }
  const signals = [];
  for (const [exercise, observations] of observationsByExercise) {
    const weekCount = new Set(observations.map((item) => getInsightWeekStart(item.date))).size;
    if (observations.length < insightRules.minimumPerformanceSessions || weekCount < insightRules.minimumPerformanceWeeks) continue;
    const preceding = observations.slice(-6, -3);
    const recent = observations.slice(-3);
    if (preceding.length < 3 || recent.length < 3) continue;
    const repDifference = Math.abs(median(preceding.map((item) => item.reps)) - median(recent.map((item) => item.reps)));
    if (repDifference > insightRules.comparableRepDifference) continue;
    const precedingEstimate = median(preceding.map((item) => item.estimate));
    const recentEstimate = median(recent.map((item) => item.estimate));
    const changePercent = (recentEstimate - precedingEstimate) / precedingEstimate * 100;
    if (Math.abs(changePercent) > insightRules.plateauTolerancePercent) continue;
    const recentGap = Math.max(...observations.slice(-6).slice(1).map((item, index) => dateDifference(observations.slice(-6)[index].date, item.date)));
    const recentSix = observations.slice(-6);
    const sessionCounts = setCountsByExerciseAndSession.get(exercise);
    const precedingSets = average(recentSix.slice(0, 3).map((item) => sessionCounts.get(item.session) ?? 0));
    const recentSets = average(recentSix.slice(3).map((item) => sessionCounts.get(item.session) ?? 0));
    const setChange = precedingSets > 0 ? Math.abs(recentSets - precedingSets) / precedingSets * 100 : 0;
    signals.push({ exercise, changePercent, sessions: observations.length, weeks: weekCount, downgraded: recentGap > insightRules.recoveryMaximumGapDays || setChange >= insightRules.plateauChangeDowngradePercent });
  }
  return signals.sort((a, b) => Math.abs(a.changePercent) - Math.abs(b.changePercent));
}

function getExerciseSessionObservations(rows) {
  const byExercise = new Map();
  for (const row of rows) {
    const estimate = estimateInsightOneRm(row);
    if (estimate === null) continue;
    const exercise = row["Exercise Name"].trim();
    const session = insightSessionKey(row);
    if (!byExercise.has(exercise)) byExercise.set(exercise, new Map());
    const current = byExercise.get(exercise).get(session);
    if (!current || estimate > current.estimate) byExercise.get(exercise).set(session, { session, date: row.Date.slice(0, 10), estimate, reps: Number(row.Reps) });
  }
  return new Map([...byExercise.entries()].map(([exercise, sessions]) => [exercise, [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date))]));
}

function updateHeadlineCards(rows, previous, weekly, consistency, topOpportunity, recovery) {
  const sessions = new Set(rows.map(insightSessionKey)).size;
  setText("#insight-sessions", sessions.toLocaleString());
  setText("#insight-sessions-note", formatPeriodDelta(sessions, previous ? new Set(previous.map(insightSessionKey)).size : null, "previous period"));
  setText("#insight-volume", `${rows.length.toLocaleString()} sets`);
  setText("#insight-volume-note", formatPeriodDelta(rows.length, previous?.length ?? null, "previous period"));
  setText("#insight-consistency", consistency.available ? `${Math.round(consistency.score)}%` : "—");
  setText("#insight-consistency-note", consistency.available ? `${consistency.mean.toFixed(1)} sessions/week · ±${consistency.deviation.toFixed(1)} typical variation` : `Needs ${insightRules.minimumCompleteWeeksForConsistency} complete weeks`);
  setText("#insight-opportunity", topOpportunity ? `${Math.round(topOpportunity.opportunity)}/100` : "—");
  setText("#insight-opportunity-note", topOpportunity ? `${capitalize(topOpportunity.muscle)} has the clearest review signal` : "Needs enough stability and complete-week data");
  setText("#insight-recovery", recovery.available ? `${Math.round(recovery.score)}%` : "—");
  setText("#insight-recovery-note", recovery.available ? `${recovery.successes} of ${recovery.comparisons} comparable repeats stayed within 2%` : `${recovery.comparisons}/${insightRules.recoveryMinimumComparablePairs} comparable repeats · not enough data`);
  renderSparkline("#sessions-sparkline", weekly.map((item) => item.sessions), "var(--cyan)");
  renderSparkline("#volume-sparkline", weekly.map((item) => item.sets), "var(--violet)");
  renderSparkline("#consistency-sparkline", weekly.map((item) => item.sessions), "var(--acid)");
  renderSparkline("#opportunity-sparkline", topOpportunity ? [topOpportunity.volumePoints, topOpportunity.frequencyPoints, topOpportunity.stabilityPoints] : [], "var(--warning)");
  renderSparkline("#recovery-sparkline", recovery.sequence, "#ff8d85");
}

function renderWeeklyActivity(weekly) {
  const container = document.querySelector("#weekly-activity-chart");
  container.replaceChildren();
  if (weekly.length === 0) {
    container.textContent = "No complete Monday–Sunday weeks fall inside this period.";
    setText("#weekly-activity-note", "Edge weeks are excluded so weekly comparisons use equal seven-day windows.");
    return;
  }
  container.append(createDualLineChart(weekly));
  setText("#weekly-activity-note", `${weekly.length} complete weeks · ${average(weekly.map((item) => item.sessions)).toFixed(1)} sessions/week · ${average(weekly.map((item) => item.sets)).toFixed(1)} logged sets/week.`);
}

function renderOpportunity(opportunity) {
  const gauge = document.querySelector("#opportunity-gauge");
  const components = document.querySelector("#opportunity-components");
  components.replaceChildren();
  if (!opportunity) {
    gauge.style.setProperty("--score", 0);
    gauge.style.setProperty("--gauge-progress", "0%");
    gauge.setAttribute("aria-label", "Opportunity score unavailable");
    setText("#gauge-score", "—");
    setText("#gauge-label", "Not enough comparable data");
    return;
  }
  const score = Math.round(opportunity.opportunity);
  gauge.style.setProperty("--score", score);
  gauge.style.setProperty("--gauge-progress", `${score / 2}%`);
  gauge.setAttribute("aria-label", `${capitalize(opportunity.muscle)} opportunity score ${score} out of 100`);
  setText("#gauge-score", score);
  setText("#gauge-label", `${capitalize(opportunity.muscle)} · ${score >= 60 ? "clear review signal" : score >= 35 ? "some review potential" : "limited review signal"}`);
  const values = [
    ["Direct volume", opportunity.volumePoints, insightRules.opportunityVolumePoints],
    ["Direct frequency", opportunity.frequencyPoints, insightRules.opportunityFrequencyPoints],
    ["Stability", opportunity.stabilityPoints, insightRules.opportunityStabilityPoints],
  ];
  for (const [label, value, maximum] of values) components.append(createScoreComponent(label, value, maximum));
}

function renderMuscleBars(muscles) {
  const container = document.querySelector("#muscle-volume-bars");
  container.replaceChildren();
  const shown = muscles.slice(0, 8);
  if (shown.length === 0) {
    container.textContent = "No mapped muscle-group data is available in complete weeks.";
    return;
  }
  const maximum = Math.max(...shown.map((muscle) => muscle.totalPerWeek), 1);
  for (const muscle of shown) {
    const row = document.createElement("div");
    row.className = "metric-bar-row";
    row.innerHTML = `<span>${capitalize(muscle.muscle)}</span><div><i style="width:${muscle.totalPerWeek / maximum * 100}%"></i></div><strong>${muscle.totalPerWeek.toFixed(1)}</strong><small>${muscle.frequencyPerWeek.toFixed(1)}×/wk direct</small>`;
    container.append(row);
  }
}

function renderEfficiency(efficiencies, period) {
  const container = document.querySelector("#efficiency-list");
  container.replaceChildren();
  if (efficiencies.length === 0) {
    container.innerHTML = `<p class="insight-empty">Not enough comparable exercise history. Each score needs ${insightRules.minimumPerformanceSessions} sessions across ${insightRules.minimumPerformanceWeeks} weeks at a similar rep range.</p>`;
    return;
  }
  for (const item of efficiencies.slice(0, 5)) {
    const row = document.createElement("a");
    row.className = "efficiency-row";
    const link = new URL("trends.html", window.location.href);
    link.searchParams.set("lift", item.exercise);
    link.searchParams.set("start", period.start);
    link.searchParams.set("end", period.end);
    row.href = link.toString();
    const description = document.createElement("span");
    const name = document.createElement("strong");
    const details = document.createElement("small");
    const score = document.createElement("b");
    name.textContent = item.exercise;
    details.textContent = `${formatSignedInsight(item.changePercent)}% e1RM · ${item.setsPerWeek.toFixed(1)} sets/week`;
    score.textContent = `${Math.round(item.score)}/100`;
    description.append(name, details);
    row.append(description, score);
    const spark = document.createElement("span");
    spark.className = "efficiency-spark";
    row.append(spark);
    container.append(row);
    renderSparklineElement(spark, item.observations.map((observation) => observation.estimate), item.score >= 60 ? "var(--acid)" : item.score >= 45 ? "var(--warning)" : "#ff6f61");
  }
}

function renderPlateaus(plateaus, period) {
  const container = document.querySelector("#plateau-list");
  container.replaceChildren();
  if (plateaus.length === 0) {
    container.innerHTML = `<p class="insight-good">No exercise met the possible-plateau rule in this period.</p><p class="table-note">Sparse or non-comparable history is not labelled a plateau.</p>`;
    return;
  }
  for (const plateau of plateaus.slice(0, 3)) {
    const item = document.createElement("a");
    const link = new URL("trends.html", window.location.href);
    link.searchParams.set("lift", plateau.exercise);
    link.searchParams.set("start", period.start);
    link.searchParams.set("end", period.end);
    item.href = link.toString();
    item.className = "plateau-item";
    const icon = document.createElement("span");
    const copy = document.createElement("div");
    const heading = document.createElement("strong");
    const explanation = document.createElement("p");
    icon.textContent = "△";
    heading.textContent = `${plateau.downgraded ? "Watch" : "Possible plateau"}: ${plateau.exercise}`;
    explanation.textContent = `${formatSignedInsight(plateau.changePercent)}% recent median e1RM change across ${plateau.sessions} sessions.${plateau.downgraded ? " A longer gap or a recent set-count change weakens the comparison." : ""}`;
    copy.append(heading, explanation);
    item.append(icon, copy);
    container.append(item);
  }
}

function renderLatestWeek(weekly) {
  const container = document.querySelector("#latest-week-summary");
  container.replaceChildren();
  if (weekly.length === 0) {
    container.textContent = "No complete week is available in the selected period.";
    return;
  }
  const latest = weekly.at(-1);
  const previous = weekly.at(-2);
  const sessionDelta = previous ? latest.sessions - previous.sessions : null;
  const setDelta = previous ? latest.sets - previous.sets : null;
  container.innerHTML = `<p class="summary-week-date">Week beginning ${formatInsightDate(latest.week)}</p>${summaryMetric("Training sessions", latest.sessions, sessionDelta)}${summaryMetric("Logged sets", latest.sets, setDelta)}<p class="table-note">Compared with the previous complete week. This does not assume a planned schedule.</p>`;
}

function renderCoverage(rows, weeks, recovery, efficiencies) {
  const container = document.querySelector("#insight-coverage");
  const unmapped = new Set(rows.map((row) => row["Exercise Name"].trim()).filter((exercise) => !exerciseMuscles[exercise]));
  const cards = [
    ["Consistency", weeks.length >= insightRules.minimumCompleteWeeksForConsistency ? "Available" : "Preliminary", `${weeks.length} complete weeks; ${insightRules.minimumCompleteWeeksForConsistency} required.`],
    ["Opportunity", recovery.available && weeks.length > 0 ? "Available" : "Preliminary", "Combines direct exposure with the performance-stability proxy; it does not prescribe more sets."],
    ["Recovery proxy", recovery.available ? "Available" : "Preliminary", `${recovery.comparisons} comparable repeats; ${insightRules.recoveryMinimumComparablePairs} required. Sleep, soreness, stress, fatigue, and injury are not known.`],
    ["Exercise efficiency", efficiencies.length > 0 ? `${efficiencies.length} scored` : "Preliminary", `Requires ${insightRules.minimumPerformanceSessions} comparable sessions across ${insightRules.minimumPerformanceWeeks} weeks per exercise.`],
    ["Muscle mapping", unmapped.size === 0 ? "Complete" : `${unmapped.size} unmapped`, unmapped.size === 0 ? "All exercises in this period contribute to muscle measures." : "Unmapped exercises are excluded from muscle volume and opportunity calculations."],
  ];
  container.replaceChildren(...cards.map(([title, status, explanation]) => {
    const card = document.createElement("article");
    card.innerHTML = `<span>${title}</span><strong>${status}</strong><p>${explanation}</p>`;
    return card;
  }));
}

function updateInsightLinks(period) {
  for (const [selector, page] of [["#volume-detail-link", "volume.html"], ["#trends-detail-link", "trends.html"]]) {
    const link = new URL(page, window.location.href);
    link.searchParams.set("start", period.start);
    link.searchParams.set("end", period.end);
    document.querySelector(selector).href = link.toString();
  }
}

function createDualLineChart(weekly) {
  const svg = createInsightSvg("svg");
  const width = 800;
  const height = 250;
  const padding = { top: 22, right: 24, bottom: 42, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Weekly training sessions and logged sets");
  for (let line = 0; line <= 4; line += 1) {
    const y = padding.top + line / 4 * plotHeight;
    appendInsightSvg(svg, "line", { x1: padding.left, x2: width - padding.right, y1: y, y2: y, class: "insight-grid-line" });
  }
  const series = [
    { key: "sessions", color: "var(--cyan)", maximum: Math.max(...weekly.map((item) => item.sessions), 1) },
    { key: "sets", color: "var(--violet)", maximum: Math.max(...weekly.map((item) => item.sets), 1) },
  ];
  for (const line of series) {
    const coordinates = weekly.map((item, index) => ({ item, x: padding.left + index / Math.max(weekly.length - 1, 1) * plotWidth, y: padding.top + (1 - item[line.key] / line.maximum) * plotHeight }));
    appendInsightSvg(svg, "polyline", { points: coordinates.map(({ x, y }) => `${x},${y}`).join(" "), fill: "none", stroke: line.color, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" });
    for (const point of coordinates) {
      const circle = appendInsightSvg(svg, "circle", { cx: point.x, cy: point.y, r: 4, fill: line.color, tabindex: 0 });
      const title = createInsightSvg("title");
      title.textContent = `Week beginning ${point.item.week}: ${point.item[line.key]} ${line.key}`;
      circle.append(title);
    }
  }
  weekly.forEach((item, index) => {
    if (index % Math.max(Math.ceil(weekly.length / 5), 1) !== 0 && index !== weekly.length - 1) return;
    const label = appendInsightSvg(svg, "text", { x: padding.left + index / Math.max(weekly.length - 1, 1) * plotWidth, y: height - 13, class: "insight-axis-label", "text-anchor": "middle" });
    label.textContent = item.week.slice(5);
  });
  return svg;
}

function createScoreComponent(label, value, maximum) {
  const row = document.createElement("div");
  row.className = "score-component";
  row.innerHTML = `<span>${label}</span><strong>${value.toFixed(0)}/${maximum}</strong><div><i style="width:${value / maximum * 100}%"></i></div>`;
  return row;
}

function renderSparkline(selector, values, color) {
  const container = document.querySelector(selector);
  container.replaceChildren();
  renderSparklineElement(container, values, color);
}

function renderSparklineElement(container, values, color) {
  if (!values || values.length < 2) return;
  const width = 120;
  const height = 34;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(maximum - minimum, 1);
  const points = values.map((value, index) => `${index / (values.length - 1) * width},${height - 3 - (value - minimum) / range * (height - 6)}`).join(" ");
  const svg = createInsightSvg("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  appendInsightSvg(svg, "polyline", { points, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round" });
  container.append(svg);
}

function summaryMetric(label, value, delta) {
  const deltaText = delta === null ? "" : `<em class="${delta >= 0 ? "positive" : "negative"}">${delta >= 0 ? "+" : ""}${delta}</em>`;
  return `<div class="weekly-summary-row"><span>${label}</span><strong>${value}</strong>${deltaText}</div>`;
}

function formatPeriodDelta(current, previous, label) {
  if (previous === null) return "No complete prior period for comparison";
  if (previous === 0) return current === 0 ? `No change vs ${label}` : `New activity vs ${label}`;
  const change = (current - previous) / previous * 100;
  return `${formatSignedInsight(change)}% vs ${label}`;
}

function estimateInsightOneRm(row) {
  const weight = Number(row["Weight (kg)"]);
  const reps = Number(row.Reps);
  return Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0 ? weight * (1 + reps / 30) : null;
}

function insightSessionKey(row) { return `${row.Date}-${row["Workout #"]}`; }
function isInInsightPeriod(dateTime, start, end) { const date = dateTime.slice(0, 10); return date >= start && date <= end; }
function addInsightDays(dateString, days) { const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function getInsightWeekStart(dateTime) { const date = new Date(`${dateTime.slice(0, 10)}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date.toISOString().slice(0, 10); }
function inclusiveInsightDays(start, end) { return Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86_400_000) + 1; }
function dateDifference(start, end) { return inclusiveInsightDays(start, end) - 1; }
function average(values) { return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length; }
function median(values) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function clamp(value, minimum, maximum) { return Math.min(Math.max(value, minimum), maximum); }
function capitalize(value) { return value ? value[0].toUpperCase() + value.slice(1) : value; }
function formatSignedInsight(value) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`; }
function formatInsightWeeks(days) { return `${(days / 7).toFixed(1)} weeks`; }
function formatInsightDate(value) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function setText(selector, text) { document.querySelector(selector).textContent = text; }
function createInsightSvg(name) { return document.createElementNS("http://www.w3.org/2000/svg", name); }
function appendInsightSvg(svg, name, attributes) { const element = createInsightSvg(name); for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value); svg.append(element); return element; }
