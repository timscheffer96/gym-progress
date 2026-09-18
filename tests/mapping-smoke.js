"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const supportedMuscles = new Set([
  "abs", "adductors", "back", "biceps", "calves", "chest", "forearms",
  "front delts", "glutes", "hamstrings", "hip flexors", "lower back",
  "quads", "rear delts", "side delts", "triceps",
]);
const sandbox = { console };
const source = fs.readFileSync(path.join(projectRoot, "exercise-muscles.js"), "utf8");

vm.runInNewContext(`${source}
  for (const [exercise, mapping] of Object.entries(exerciseMuscles)) {
    if (!Array.isArray(mapping.primary) || mapping.primary.length === 0) throw new Error(exercise + " has no primary muscle.");
    if (!Array.isArray(mapping.secondary)) throw new Error(exercise + " has invalid secondary muscles.");
    for (const muscle of [...mapping.primary, ...mapping.secondary]) {
      if (!__supportedMuscles.has(muscle)) throw new Error(exercise + " uses unsupported muscle: " + muscle);
    }
  }
  console.log(JSON.stringify({ mappedExercises: Object.keys(exerciseMuscles).length }));
`, { ...sandbox, __supportedMuscles: supportedMuscles }, { filename: "mapping-smoke.vm.js" });
