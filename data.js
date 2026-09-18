"use strict";

const importedRowsStorageKey = "gym-progress-imported-rows";
const legacyImportedRowsStorageKey = "gym-progress-imported-strong-rows";

const workoutCsvFormats = {
  Strong: {
    delimiter: ";",
    requiredHeaders: ["Workout #", "Date", "Exercise Name", "Set Order"],
  },
  Hevy: {
    delimiter: ",",
    requiredHeaders: ["title", "start_time", "exercise_title", "set_index", "weight_kg", "reps"],
  },
};

// Hevy and Strong sometimes use different names for the same movement. Keeping
// one canonical name means existing muscle mappings and lift trends still work.
const hevyExerciseAliases = {
  "Back Extension (Weighted Hyperextension)": "Back Extension",
  "Bulgarian Split Squat (Dumbbell)": "Bulgarian Split Squat",
  "Butterfly (Pec Deck)": "Pec Deck (Machine)",
  "Chest Fly (Machine)": "Chest Fly",
  "Hack Squat (Machine)": "Hack Squat",
  "Hip Adduction (Machine)": "Hip Adductor (Machine)",
  "Knee Raise Parallel Bars": "Knee Raise (Captain's Chair)",
  "Leg Press (Machine)": "Leg Press",
  "Pull Up (Weighted)": "Pull Up",
  "Rear Delt Reverse Fly (Cable)": "Reverse Fly (Cable)",
  "Rear Delt Reverse Fly (Machine)": "Reverse Fly (Machine)",
  "Seated Cable Row - V Grip (Cable)": "Seated Row (Cable)",
  "Seated Calf Raise": "Seated Calf Raise (Plate Loaded)",
  "Single Arm Lat Pulldown": "Lat Pulldown (Single Arm)",
  "Triceps Pushdown": "Triceps Pushdown (Cable - Straight Bar)",
};

function parseWorkoutCsv(text) {
  const format = detectWorkoutCsvFormat(text);
  const config = workoutCsvFormats[format];
  const [rawHeaders, ...dataRows] = parseDelimitedText(text, config.delimiter);
  const headers = cleanCsvHeaders(rawHeaders);
  const records = dataRows
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));

  return format === "Strong" ? normalizeStrongRows(records) : normalizeHevyRows(records);
}

// Kept for backwards compatibility with the existing smoke tests and any
// locally saved development snippets. It now auto-detects both formats.
function parseStrongCsv(text) {
  return parseWorkoutCsv(text);
}

function detectWorkoutCsvFormat(text) {
  if (!text || text.trim() === "") {
    throw new Error("The CSV is empty.");
  }

  for (const [format, config] of Object.entries(workoutCsvFormats)) {
    const [rawHeaders] = parseDelimitedText(text, config.delimiter);
    const headers = cleanCsvHeaders(rawHeaders);

    if (config.requiredHeaders.every((header) => headers.includes(header))) {
      return format;
    }
  }

  throw new Error("This is not a recognised Strong or Hevy export. Check that you selected the original CSV export.");
}

function cleanCsvHeaders(headers = []) {
  return headers.map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim());
}

function normalizeStrongRows(records) {
  return records
    .filter((row) => row["Exercise Name"].trim() !== "")
    .map((row) => ({ ...row, "Exercise Name": row["Exercise Name"].trim(), "Source App": "Strong" }));
}

function normalizeHevyRows(records) {
  const workoutIds = new Map();

  return records
    .filter((row) => row.exercise_title.trim() !== "")
    .filter((row) => (row.set_type ?? "").trim().toLowerCase() !== "warmup")
    .map((row) => {
      const workoutKey = `${row.start_time}|${row.title}`;
      if (!workoutIds.has(workoutKey)) workoutIds.set(workoutKey, String(workoutIds.size + 1));

      const exerciseName = row.exercise_title.trim();
      return {
        "Workout #": workoutIds.get(workoutKey),
        Date: normalizeHevyDate(row.start_time),
        "Workout Name": row.title.trim(),
        "Duration (sec)": getHevyDurationSeconds(row.start_time, row.end_time),
        "Exercise Name": hevyExerciseAliases[exerciseName] ?? exerciseName,
        "Set Order": row.set_index === "" ? "" : String(Number(row.set_index) + 1),
        "Weight (kg)": row.weight_kg,
        Reps: row.reps,
        RPE: row.rpe ?? "",
        "Distance (meters)": !row.distance_km ? "" : String(Number(row.distance_km) * 1000),
        Seconds: row.duration_seconds ?? "",
        Notes: row.exercise_notes ?? "",
        "Workout Notes": row.description ?? "",
        "Set Type": row.set_type ?? "",
        "Source App": "Hevy",
      };
    });
}

function normalizeHevyDate(value) {
  const match = value.trim().match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4}), (\d{1,2}):(\d{2})$/);
  const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

  if (!match || !months[match[2]]) {
    throw new Error(`Could not read Hevy workout date: ${value}`);
  }

  const [, day, month, year, hour, minute] = match;
  return `${year}-${months[month]}-${day.padStart(2, "0")} ${hour.padStart(2, "0")}:${minute}:00`;
}

function getHevyDurationSeconds(startValue, endValue) {
  if (!startValue || !endValue) return "";
  const start = new Date(normalizeHevyDate(startValue).replace(" ", "T"));
  const end = new Date(normalizeHevyDate(endValue).replace(" ", "T"));
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? String(seconds) : "";
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

function saveImportedRows(rows) {
  localStorage.setItem(importedRowsStorageKey, JSON.stringify(rows));
}

function loadImportedRows() {
  const savedRows = localStorage.getItem(importedRowsStorageKey) ?? localStorage.getItem(legacyImportedRowsStorageKey);
  return savedRows ? JSON.parse(savedRows) : [];
}
