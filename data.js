"use strict";

const importedRowsStorageKey = "gym-progress-imported-strong-rows";

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

function saveImportedRows(rows) {
  localStorage.setItem(importedRowsStorageKey, JSON.stringify(rows));
}

function loadImportedRows() {
  const savedRows = localStorage.getItem(importedRowsStorageKey);
  return savedRows ? JSON.parse(savedRows) : [];
}
