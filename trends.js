"use strict";

const liftSelect = document.querySelector("#lift-select");
const noImport = document.querySelector("#no-import");
const trendsContent = document.querySelector("#trends-content");
const liftContext = document.querySelector("#lift-context");
const trendChart = document.querySelector("#trend-chart");
const trendTableHead = document.querySelector("#trend-table-head");
const trendTableBody = document.querySelector("#trend-table-body");
let importedRows = [];

initialiseTrendsPage();

function initialiseTrendsPage() {
  importedRows = loadImportedRows();

  if (importedRows.length === 0) {
    noImport.hidden = false;
    return;
  }

  const exerciseNames = [...new Set(importedRows.map((row) => row["Exercise Name"].trim()))].sort();

  for (const exerciseName of exerciseNames) {
    const option = document.createElement("option");
    option.value = exerciseName;
    option.textContent = exerciseName;
    liftSelect.append(option);
  }

  const defaultLift = exerciseNames.includes("Bench Press (Barbell)") ? "Bench Press (Barbell)" : exerciseNames[0];
  liftSelect.value = defaultLift;
  liftSelect.addEventListener("change", () => showLiftTrends(liftSelect.value));
  trendsContent.hidden = false;
  showLiftTrends(defaultLift);
}

function showLiftTrends(liftName) {
  const mapping = exerciseMuscles[liftName];
  const focusMuscles = mapping ? [...new Set([...mapping.primary, ...mapping.secondary])] : [];
  const weeks = getLatestTwelveWeeks(importedRows);
  const liftMetrics = getLiftWeeklyMetrics(importedRows, liftName, weeks);
  const muscleVolumes = getMuscleWeeklyVolumes(importedRows, focusMuscles, weeks);

  liftContext.textContent = mapping
    ? `Focus muscles: ${focusMuscles.join(", ")}. Direct-set columns include all exercises that directly train those muscles.`
    : "This exercise is not mapped yet, so muscle-volume columns are unavailable.";

  showTrendSummary(liftMetrics, focusMuscles.length);
  showTrendChart(liftMetrics);
  showTrendTable(weeks, liftMetrics, focusMuscles, muscleVolumes);
}

function getLatestTwelveWeeks(rows) {
  const dates = rows.map((row) => row.Date).filter(Boolean).sort();
  const latestWeek = getWeekStart(dates.at(-1));
  const weeks = [];
  const cursor = new Date(`${latestWeek}T12:00:00`);

  for (let index = 11; index >= 0; index -= 1) {
    const week = new Date(cursor);
    week.setDate(week.getDate() - index * 7);
    weeks.push(week.toISOString().slice(0, 10));
  }

  return weeks;
}

function getLiftWeeklyMetrics(rows, liftName, weeks) {
  const metrics = new Map(weeks.map((week) => [week, { bestEstimate: null, workouts: new Set() }]));

  for (const row of rows) {
    if (row["Exercise Name"].trim() !== liftName) {
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

function getMuscleWeeklyVolumes(rows, focusMuscles, weeks) {
  const volume = new Map(weeks.map((week) => [week, new Map(focusMuscles.map((muscle) => [muscle, 0]))]));

  for (const row of rows) {
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];
    const weekVolumes = volume.get(getWeekStart(row.Date));
    if (!mapping || !weekVolumes) {
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

function showTrendSummary(liftMetrics, focusMuscleCount) {
  const metrics = [...liftMetrics.values()];
  const latestEstimate = [...metrics].reverse().find((metric) => metric.bestEstimate !== null)?.bestEstimate;
  const workoutCount = metrics.reduce((total, metric) => total + metric.workouts.size, 0);
  const weekCount = metrics.filter((metric) => metric.workouts.size > 0).length;

  document.querySelector("#latest-one-rm").textContent = latestEstimate === undefined ? "—" : `${latestEstimate.toFixed(1)} kg`;
  document.querySelector("#lift-workout-count").textContent = workoutCount;
  document.querySelector("#lift-week-count").textContent = weekCount;
  document.querySelector("#focus-muscle-count").textContent = focusMuscleCount;
}

function showTrendTable(weeks, liftMetrics, focusMuscles, muscleVolumes) {
  trendTableHead.replaceChildren();
  trendTableBody.replaceChildren();
  const headerRow = document.createElement("tr");
  const headers = ["Week beginning", "Best estimated 1RM", "Lift workouts", ...focusMuscles.map((muscle) => `${muscle} direct sets`)];

  for (const headerText of headers) {
    const header = document.createElement("th");
    header.textContent = headerText;
    headerRow.append(header);
  }
  trendTableHead.append(headerRow);

  for (const week of weeks) {
    const metric = liftMetrics.get(week);
    const cells = [week, metric.bestEstimate === null ? "—" : `${metric.bestEstimate.toFixed(1)} kg`, metric.workouts.size, ...focusMuscles.map((muscle) => muscleVolumes.get(week).get(muscle))];
    const row = document.createElement("tr");

    for (const cellText of cells) {
      const cell = document.createElement("td");
      cell.textContent = cellText;
      row.append(cell);
    }
    trendTableBody.append(row);
  }
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
    const x = padding.left + (weekIndex / 11) * plotWidth;
    const y = padding.top + ((maximum - point.estimate) / (maximum - minimum)) * plotHeight;
    return { x, y };
  });
  appendSvg(svg, "polyline", { points: coordinates.map(({ x, y }) => `${x},${y}`).join(" "), class: "chart-line" });
  for (const coordinate of coordinates) {
    appendSvg(svg, "circle", { cx: coordinate.x, cy: coordinate.y, r: 4, class: "chart-point" });
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

function appendSvg(svg, tagName, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  svg.append(element);
}

function appendLabel(svg, text, x, y) {
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", x);
  label.setAttribute("y", y);
  label.setAttribute("class", "chart-label");
  label.textContent = text;
  svg.append(label);
}
