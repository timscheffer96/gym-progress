"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const sandbox = { localStorage: { getItem() { return null; }, setItem() {} } };
const source = fs.readFileSync(path.join(projectRoot, "data.js"), "utf8");

const strongCsv = `"Workout #";"Date";"Workout Name";"Exercise Name";"Set Order";"Weight (kg)";"Reps"
"1";"2026-09-18 13:27:00";"Upper body";"Bench Press (Barbell)";"1";"110";"5"`;

const hevyCsv = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Upper body","18 Sep 2026, 13:27","18 Sep 2026, 14:32","","Bench Press (Barbell)",,"",0,"normal",110,5,,,
"Upper body","18 Sep 2026, 13:27","18 Sep 2026, 14:32","","Butterfly (Pec Deck)",,"",1,"dropset",50,10,,,
"Upper body","18 Sep 2026, 13:27","18 Sep 2026, 14:32","","Bench Press (Barbell)",,"",2,"warmup",20,10,,,`;

vm.runInNewContext(`${source}
  const strongRows = parseWorkoutCsv(${JSON.stringify(strongCsv)});
  const hevyRows = parseWorkoutCsv(${JSON.stringify(hevyCsv)});
  if (detectWorkoutCsvFormat(${JSON.stringify(strongCsv)}) !== "Strong") throw new Error("Strong format was not detected.");
  if (detectWorkoutCsvFormat(${JSON.stringify(hevyCsv)}) !== "Hevy") throw new Error("Hevy format was not detected.");
  if (strongRows.length !== 1 || strongRows[0]["Source App"] !== "Strong") throw new Error("Strong normalization failed.");
  if (hevyRows.length !== 2) throw new Error("Hevy warm-up filtering failed.");
  if (hevyRows[0].Date !== "2026-09-18 13:27:00") throw new Error("Hevy date normalization failed.");
  if (hevyRows[0]["Weight (kg)"] !== "110" || hevyRows[0].Reps !== "5") throw new Error("Hevy lift fields failed.");
  if (hevyRows[1]["Exercise Name"] !== "Pec Deck (Machine)") throw new Error("Hevy exercise alias failed.");
  if (hevyRows[0]["Duration (sec)"] !== "3900") throw new Error("Hevy duration normalization failed.");
`, sandbox, { filename: "import-smoke.vm.js" });

console.log(JSON.stringify({ formats: ["Strong", "Hevy"], hevyWorkingSets: 2 }));
