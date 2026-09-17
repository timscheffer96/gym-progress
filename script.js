"use strict";

const csvFileInput = document.querySelector("#csv-file");
const fileStatus = document.querySelector("#file-status");
const results = document.querySelector("#results");
const setsTableBody = document.querySelector("#sets-table-body");
const unmappedList = document.querySelector("#unmapped-list");
const unmappedMessage = document.querySelector("#unmapped-message");
const muscleSetSummary = document.querySelector("#muscle-set-summary");
const weeklyTableBody = document.querySelector("#weekly-table-body");
const oneRmCharts = document.querySelector("#one-rm-charts");

const selectedLifts = [
  { name: "Barbell bench press", strongName: "Bench Press (Barbell)" },
  { name: "Barbell squat", strongName: "Squat (Barbell)" },
  { name: "Conventional deadlift", strongName: "Deadlift (Barbell)" },
];

csvFileInput.addEventListener("change", handleFileSelection);

async function handleFileSelection(event) {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  try {
    fileStatus.textContent = `Reading ${file.name}…`;
    const text = await file.text();
    const rows = parseStrongCsv(text);
    showImport(rows, file.name);
  } catch (error) {
    results.hidden = true;
    fileStatus.textContent = `Could not import this file: ${error.message}`;
  }
}

function parseStrongCsv(text) {
  const records = parseDelimitedText(text, ";");
  const [headers, ...dataRows] = records;

  if (!headers || headers.length === 0) {
    throw new Error("The CSV is empty.");
  }

  const requiredHeaders = ["Workout #", "Date", "Exercise Name", "Set Order"];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`This is not a recognised Strong export. Missing: ${missingHeaders.join(", ")}.`);
  }

  return dataRows
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
    .filter((row) => row["Exercise Name"].trim() !== "");
}

function parseDelimitedText(text, delimiter) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === delimiter && !insideQuotes) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function showImport(rows, fileName) {
  const workoutIds = new Set(rows.map((row) => row["Workout #"]));
  const exerciseNames = [...new Set(rows.map((row) => row["Exercise Name"].trim()))].sort();
  const unmappedExercises = exerciseNames.filter((exerciseName) => !exerciseMuscles[exerciseName]);

  document.querySelector("#set-count").textContent = rows.length.toLocaleString();
  document.querySelector("#workout-count").textContent = workoutIds.size.toLocaleString();
  document.querySelector("#exercise-count").textContent = exerciseNames.length.toLocaleString();
  document.querySelector("#unmapped-count").textContent = unmappedExercises.length.toLocaleString();
  fileStatus.textContent = `${fileName} imported successfully. Nothing was uploaded.`;

  showUnmappedExercises(unmappedExercises);
  showHardSetSummary(rows);
  showWeeklyHardSets(rows);
  showOneRepMaxTrends(rows);
  showSetRows(rows.slice(0, 25));
  results.hidden = false;
}

function showOneRepMaxTrends(rows) {
  oneRmCharts.replaceChildren();

  for (const lift of selectedLifts) {
    const points = getBestOneRepMaxes(rows, lift.strongName);
    oneRmCharts.append(createOneRmCard(lift.name, points));
  }
}

function getBestOneRepMaxes(rows, exerciseName) {
  const bestByWorkout = new Map();

  for (const row of rows) {
    if (row["Exercise Name"].trim() !== exerciseName) {
      continue;
    }

    const weight = Number(row["Weight (kg)"]);
    const reps = Number(row.Reps);

    if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
      continue;
    }

    const estimate = weight * (1 + reps / 30);
    const workoutId = row["Workout #"];
    const currentBest = bestByWorkout.get(workoutId);

    if (!currentBest || estimate > currentBest.estimate) {
      bestByWorkout.set(workoutId, { date: row.Date.slice(0, 10), estimate });
    }
  }

  return [...bestByWorkout.values()].sort((first, second) => first.date.localeCompare(second.date));
}

function createOneRmCard(liftName, points) {
  const card = document.createElement("article");
  card.className = "one-rm-card";
  const title = document.createElement("h4");
  title.textContent = liftName;
  const description = document.createElement("p");

  card.append(title, description);

  if (points.length === 0) {
    description.textContent = "No weight-and-rep data found for this exact Strong exercise.";
    return card;
  }

  const latest = points.at(-1).estimate;
  const first = points[0].estimate;
  const change = latest - first;
  const changeText = `${change >= 0 ? "+" : ""}${change.toFixed(1)} kg since first record`;
  description.textContent = `Latest: ${latest.toFixed(1)} kg · ${changeText}`;
  card.append(createLineChart(points, liftName));
  return card;
}

function createLineChart(points, liftName) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const width = 520;
  const height = 230;
  const padding = { top: 20, right: 20, bottom: 35, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const estimates = points.map((point) => point.estimate);
  const lowest = Math.min(...estimates);
  const highest = Math.max(...estimates);
  const rangePadding = Math.max((highest - lowest) * 0.15, 2.5);
  const minimum = lowest - rangePadding;
  const maximum = highest + rangePadding;
  const range = maximum - minimum;
  const svg = document.createElementNS(svgNamespace, "svg");

  svg.classList.add("one-rm-chart");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${liftName} estimated one-repetition maximum trend`);

  appendSvgElement(svg, "line", { x1: padding.left, y1: padding.top, x2: padding.left, y2: height - padding.bottom, class: "chart-axis" });
  appendSvgElement(svg, "line", { x1: padding.left, y1: height - padding.bottom, x2: width - padding.right, y2: height - padding.bottom, class: "chart-axis" });
  appendChartLabel(svg, `${maximum.toFixed(0)} kg`, 4, padding.top + 4);
  appendChartLabel(svg, `${minimum.toFixed(0)} kg`, 4, height - padding.bottom + 4);
  appendChartLabel(svg, points[0].date, padding.left, height - 10, "start");
  appendChartLabel(svg, points.at(-1).date, width - padding.right, height - 10, "end");

  const coordinates = points.map((point, index) => {
    const x = padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = padding.top + ((maximum - point.estimate) / range) * plotHeight;
    return { x, y };
  });

  appendSvgElement(svg, "polyline", { points: coordinates.map(({ x, y }) => `${x},${y}`).join(" "), class: "chart-line" });

  for (const coordinate of coordinates) {
    appendSvgElement(svg, "circle", { cx: coordinate.x, cy: coordinate.y, r: 3.5, class: "chart-point" });
  }

  return svg;
}

function appendSvgElement(svg, tagName, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  svg.append(element);
}

function appendChartLabel(svg, text, x, y, textAnchor = "start") {
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", x);
  label.setAttribute("y", y);
  label.setAttribute("text-anchor", textAnchor);
  label.setAttribute("class", "chart-label");
  label.textContent = text;
  svg.append(label);
}

function showHardSetSummary(rows) {
  const directSets = new Map();
  const indirectSets = new Map();

  for (const row of rows) {
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];

    if (!mapping) {
      continue;
    }

    addSetCounts(directSets, mapping.primary);
    addSetCounts(indirectSets, mapping.secondary);
  }

  muscleSetSummary.replaceChildren();

  for (const [muscle, count] of [...directSets.entries()].sort((a, b) => b[1] - a[1])) {
    const card = document.createElement("article");
    card.className = "muscle-set-card";
    const indirectCount = indirectSets.get(muscle) ?? 0;
    card.innerHTML = `<strong>${count} direct sets</strong><span>${muscle} · ${indirectCount} indirect sets</span>`;
    muscleSetSummary.append(card);
  }
}

function showWeeklyHardSets(rows) {
  const weeks = new Map();

  for (const row of rows) {
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];
    const weekStart = getWeekStart(row.Date);

    if (!mapping || !weekStart) {
      continue;
    }

    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, new Map());
    }
    addSetCounts(weeks.get(weekStart), mapping.primary);
  }

  weeklyTableBody.replaceChildren();
  const recentWeeks = [...weeks.entries()].sort(([first], [second]) => second.localeCompare(first)).slice(0, 12);

  for (const [weekStart, muscleCounts] of recentWeeks) {
    const totalSets = [...muscleCounts.values()].reduce((total, count) => total + count, 0);
    const breakdown = [...muscleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, count]) => `${muscle}: ${count}`)
      .join(" · ");
    const tableRow = document.createElement("tr");

    for (const cellText of [weekStart, totalSets, breakdown]) {
      const cell = document.createElement("td");
      cell.textContent = cellText;
      tableRow.append(cell);
    }

    weeklyTableBody.append(tableRow);
  }
}

function addSetCounts(counts, muscles) {
  for (const muscle of muscles) {
    counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
  }
}

function getWeekStart(dateTime) {
  if (!dateTime) {
    return null;
  }

  const date = new Date(`${dateTime.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const dayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayOffset);
  return date.toISOString().slice(0, 10);
}

function showUnmappedExercises(unmappedExercises) {
  unmappedList.replaceChildren();

  if (unmappedExercises.length === 0) {
    unmappedMessage.textContent = "All imported exercises have a mapping.";
    return;
  }

  unmappedMessage.textContent = "Add these exercise names to exercise-muscles.js before using muscle-group set totals.";

  for (const exerciseName of unmappedExercises) {
    const item = document.createElement("li");
    item.textContent = exerciseName;
    unmappedList.append(item);
  }
}

function showSetRows(rows) {
  setsTableBody.replaceChildren();

  for (const row of rows) {
    const exerciseName = row["Exercise Name"].trim();
    const mapping = exerciseMuscles[exerciseName];
    const cells = [
      formatDate(row.Date),
      exerciseName,
      row["Weight (kg)"] ? `${row["Weight (kg)"]} kg` : "—",
      row.Reps || "—",
      mapping ? mapping.primary.join(", ") : "Not mapped",
      mapping?.secondary.join(", ") || "—",
    ];
    const tableRow = document.createElement("tr");

    for (const cellText of cells) {
      const cell = document.createElement("td");
      cell.textContent = cellText;
      tableRow.append(cell);
    }

    setsTableBody.append(tableRow);
  }
}

function formatDate(value) {
  return value ? value.slice(0, 10) : "—";
}
