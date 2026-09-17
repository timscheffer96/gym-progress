"use strict";

const csvFileInput = document.querySelector("#csv-file");
const fileStatus = document.querySelector("#file-status");
const results = document.querySelector("#results");
const setsTableBody = document.querySelector("#sets-table-body");
const unmappedList = document.querySelector("#unmapped-list");
const unmappedMessage = document.querySelector("#unmapped-message");
const muscleSetSummary = document.querySelector("#muscle-set-summary");
const weeklyTableBody = document.querySelector("#weekly-table-body");

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
  showSetRows(rows.slice(0, 25));
  results.hidden = false;
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
