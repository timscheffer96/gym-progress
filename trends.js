"use strict";

const liftSelect = document.querySelector("#lift-select");
const noImport = document.querySelector("#no-import");
const trendsContent = document.querySelector("#trends-content");
const liftContext = document.querySelector("#lift-context");
const trendChart = document.querySelector("#trend-chart");
const trendTableHead = document.querySelector("#trend-table-head");
const trendTableBody = document.querySelector("#trend-table-body");
const startDateInput = document.querySelector("#start-date");
const endDateInput = document.querySelector("#end-date");
let importedRows = [];

initialiseTrendsPage();

function initialiseTrendsPage() {
  importedRows = loadImportedRows();

  if (importedRows.length === 0) {
    noImport.hidden = false;
    return;
  }

  const exerciseNames = [...new Set(importedRows.map((row) => row["Exercise Name"].trim()))].sort();
  const availableDates = importedRows.map((row) => row.Date.slice(0, 10)).filter(Boolean).sort();
  const earliestDate = availableDates[0];
  const latestDate = availableDates.at(-1);

  for (const exerciseName of exerciseNames) {
    const option = document.createElement("option");
    option.value = exerciseName;
    option.textContent = exerciseName;
    liftSelect.append(option);
  }

  const defaultLift = exerciseNames.includes("Bench Press (Barbell)") ? "Bench Press (Barbell)" : exerciseNames[0];
  const sharedLink = new URLSearchParams(window.location.search);
  const linkedLift = sharedLink.get("lift");
  liftSelect.value = exerciseNames.includes(linkedLift) ? linkedLift : defaultLift;
  startDateInput.min = earliestDate;
  startDateInput.max = latestDate;
  endDateInput.min = earliestDate;
  endDateInput.max = latestDate;
  endDateInput.value = validLinkedDate(sharedLink.get("end"), earliestDate, latestDate) ?? latestDate;
  startDateInput.value = validLinkedDate(sharedLink.get("start"), earliestDate, latestDate) ?? [earliestDate, dateDaysBefore(latestDate, 83)].sort().at(-1);
  if (startDateInput.value > endDateInput.value) {
    startDateInput.value = [earliestDate, dateDaysBefore(endDateInput.value, 83)].sort().at(-1);
  }
  liftSelect.addEventListener("change", showSelectedTrends);
  startDateInput.addEventListener("change", showSelectedTrends);
  endDateInput.addEventListener("change", showSelectedTrends);
  trendsContent.hidden = false;
  showSelectedTrends();
}

function showSelectedTrends() {
  if (startDateInput.value > endDateInput.value) {
    liftContext.textContent = "The start date must be on or before the end date.";
    return;
  }
  showLiftTrends(liftSelect.value, startDateInput.value, endDateInput.value);
}

function showLiftTrends(liftName, startDate, endDate) {
  const mapping = exerciseMuscles[liftName];
  const focusMuscles = mapping ? [...new Set([...mapping.primary, ...mapping.secondary])] : [];
  const weeks = getWeeksForPeriod(startDate, endDate);
  const liftMetrics = getLiftWeeklyMetrics(importedRows, liftName, weeks, startDate, endDate);
  const muscleVolumes = getMuscleWeeklyVolumes(importedRows, focusMuscles, weeks, startDate, endDate);
  const periodTotals = getPeriodTotals(liftMetrics, focusMuscles, muscleVolumes, startDate, endDate);

  liftContext.textContent = mapping
    ? `Focus muscles: ${focusMuscles.join(", ")}. Direct-set totals include all exercises that directly train those muscles.`
    : "This exercise is not mapped yet, so muscle-volume columns are unavailable.";

  showTrendSummary(periodTotals, focusMuscles.length);
  showTrendChart(liftMetrics);
  showPeriodSummaryTable(startDate, endDate, periodTotals, focusMuscles);
}

function getWeeksForPeriod(startDate, endDate) {
  const firstWeek = getWeekStart(startDate);
  const lastWeek = getWeekStart(endDate);
  const weeks = [];
  const cursor = new Date(`${firstWeek}T12:00:00`);

  while (cursor.toISOString().slice(0, 10) <= lastWeek) {
    weeks.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

function getLiftWeeklyMetrics(rows, liftName, weeks, startDate, endDate) {
  const metrics = new Map(weeks.map((week) => [week, { bestEstimate: null, workouts: new Set() }]));

  for (const row of rows) {
    if (row["Exercise Name"].trim() !== liftName || !isInPeriod(row.Date, startDate, endDate)) {
      continue;
    }

    const week = getWeekStart(row.Date);
    const weekMetric = metrics.get(week);
    if (!weekMetric) {
      continue;
    }

    weekMetric.workouts.add(`${row.Date}-${row["Workout #"]}`);
    const estimate = estimateOneRepMax(row);
    if (estimate !== null && (weekMetric.bestEstimate === null || estimate > weekMetric.bestEstimate)) {
      weekMetric.bestEstimate = estimate;
    }
  }

  return metrics;
}

function getMuscleWeeklyVolumes(rows, focusMuscles, weeks, startDate, endDate) {
  const volume = new Map(weeks.map((week) => [week, new Map(focusMuscles.map((muscle) => [muscle, 0]))]));

  for (const row of rows) {
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];
    const weekVolumes = volume.get(getWeekStart(row.Date));
    if (!mapping || !weekVolumes || !isInPeriod(row.Date, startDate, endDate)) {
      continue;
    }

    for (const muscle of mapping.primary) {
      if (weekVolumes.has(muscle)) {
        weekVolumes.set(muscle, weekVolumes.get(muscle) + 1);
      }
    }
  }

  return volume;
}

function getPeriodTotals(liftMetrics, focusMuscles, muscleVolumes, startDate, endDate) {
  const metrics = [...liftMetrics.values()];
  const estimates = metrics.map((metric) => metric.bestEstimate).filter((estimate) => estimate !== null);
  const muscleTotals = new Map(focusMuscles.map((muscle) => [muscle, 0]));
  const weeksInPeriod = numberOfWeeksInPeriod(startDate, endDate);

  for (const weekVolume of muscleVolumes.values()) {
    for (const muscle of focusMuscles) {
      muscleTotals.set(muscle, muscleTotals.get(muscle) + weekVolume.get(muscle));
    }
  }

  return {
    bestEstimate: estimates.length === 0 ? null : Math.max(...estimates),
    workoutCount: metrics.reduce((total, metric) => total + metric.workouts.size, 0),
    weekCount: metrics.filter((metric) => metric.workouts.size > 0).length,
    averageMuscleSets: new Map(focusMuscles.map((muscle) => [muscle, muscleTotals.get(muscle) / weeksInPeriod])),
  };
}

function showTrendSummary(periodTotals, focusMuscleCount) {
  document.querySelector("#latest-one-rm").textContent = periodTotals.bestEstimate === null ? "—" : `${periodTotals.bestEstimate.toFixed(1)} kg`;
  document.querySelector("#lift-workout-count").textContent = periodTotals.workoutCount;
  document.querySelector("#lift-week-count").textContent = periodTotals.weekCount;
  document.querySelector("#focus-muscle-count").textContent = focusMuscleCount;
}

function showPeriodSummaryTable(startDate, endDate, periodTotals, focusMuscles) {
  trendTableHead.replaceChildren();
  trendTableBody.replaceChildren();
  const headerRow = document.createElement("tr");
  const headers = ["Selected period", "Best estimated 1RM", "Lift workouts", "Weeks trained", ...focusMuscles.map((muscle) => `${muscle} avg. direct sets/week`)];

  for (const headerText of headers) {
    const header = document.createElement("th");
    header.textContent = headerText;
    headerRow.append(header);
  }
  trendTableHead.append(headerRow);

  const cells = [`${startDate} to ${endDate}`, periodTotals.bestEstimate === null ? "—" : `${periodTotals.bestEstimate.toFixed(1)} kg`, periodTotals.workoutCount, periodTotals.weekCount, ...focusMuscles.map((muscle) => periodTotals.averageMuscleSets.get(muscle).toFixed(1))];
  const row = document.createElement("tr");
  for (const cellText of cells) {
    const cell = document.createElement("td");
    cell.textContent = cellText;
    row.append(cell);
  }
  trendTableBody.append(row);
}

function showTrendChart(liftMetrics) {
  const points = [...liftMetrics.entries()]
    .filter(([, metric]) => metric.bestEstimate !== null)
    .map(([week, metric]) => ({ week, estimate: metric.bestEstimate }));

  trendChart.replaceChildren();

  if (points.length === 0) {
    trendChart.textContent = "No weight-and-rep data is available for this lift in the latest 12 weeks.";
    return;
  }

  const svgNamespace = "http://www.w3.org/2000/svg";
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 35, left: 55 };
  const estimates = points.map((point) => point.estimate);
  const lowest = Math.min(...estimates);
  const highest = Math.max(...estimates);
  const rangePadding = Math.max((highest - lowest) * 0.15, 2.5);
  const minimum = lowest - rangePadding;
  const maximum = highest + rangePadding;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const svg = document.createElementNS(svgNamespace, "svg");

  svg.classList.add("one-rm-chart");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Estimated one-repetition maximum trend");
  appendSvg(svg, "line", { x1: padding.left, y1: padding.top, x2: padding.left, y2: height - padding.bottom, class: "chart-axis" });
  appendSvg(svg, "line", { x1: padding.left, y1: height - padding.bottom, x2: width - padding.right, y2: height - padding.bottom, class: "chart-axis" });
  appendLabel(svg, `${maximum.toFixed(0)} kg`, 5, padding.top + 4);
  appendLabel(svg, `${minimum.toFixed(0)} kg`, 5, height - padding.bottom + 4);

  const coordinates = points.map((point) => {
    const weekIndex = [...liftMetrics.keys()].indexOf(point.week);
    const x = padding.left + (weekIndex / Math.max(liftMetrics.size - 1, 1)) * plotWidth;
    const y = padding.top + ((maximum - point.estimate) / (maximum - minimum)) * plotHeight;
    return { ...point, x, y };
  });
  appendSvg(svg, "polyline", { points: coordinates.map(({ x, y }) => `${x},${y}`).join(" "), class: "chart-line" });
  for (const coordinate of coordinates) {
    const point = appendSvg(svg, "circle", { cx: coordinate.x, cy: coordinate.y, r: 5, class: "chart-point", tabindex: 0 });
    const tooltip = document.createElementNS(svgNamespace, "title");
    tooltip.textContent = `Week beginning ${coordinate.week}: estimated 1RM ${coordinate.estimate.toFixed(1)} kg`;
    point.append(tooltip);
  }
  trendChart.append(svg);
}

function estimateOneRepMax(row) {
  const weight = Number(row["Weight (kg)"]);
  const reps = Number(row.Reps);
  return Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0 ? weight * (1 + reps / 30) : null;
}

function getWeekStart(dateTime) {
  if (!dateTime) {
    return null;
  }

  const date = new Date(`${dateTime.slice(0, 10)}T12:00:00`);
  const dayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOffset);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function isInPeriod(dateTime, startDate, endDate) {
  const date = dateTime.slice(0, 10);
  return date >= startDate && date <= endDate;
}

function dateDaysBefore(dateString, numberOfDays) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() - numberOfDays);
  return date.toISOString().slice(0, 10);
}

function validLinkedDate(value, earliestDate, latestDate) {
  return value && value >= earliestDate && value <= latestDate ? value : null;
}

function numberOfWeeksInPeriod(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const days = Math.round((end - start) / 86_400_000) + 1;
  return days / 7;
}

function appendSvg(svg, tagName, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  svg.append(element);
  return element;
}

function appendLabel(svg, text, x, y) {
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", x);
  label.setAttribute("y", y);
  label.setAttribute("class", "chart-label");
  label.textContent = text;
  svg.append(label);
}
