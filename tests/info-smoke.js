"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "info.html"), "utf8");
const keys = [...new Set([...html.matchAll(/data-info-rule="([^"]+)"/g)].map((match) => match[1]))];
const nodes = keys.map((key) => ({ dataset: { infoRule: key }, textContent: "" }));
const versionNode = { textContent: "" };
const sandbox = {
  document: {
    querySelectorAll(selector) { return selector === "[data-info-rule]" ? nodes : []; },
    querySelector(selector) { return selector === "#measure-doc-version" ? versionNode : null; },
  },
};

const sources = ["insights-rules.js", "coach-rules.js", "info.js"]
  .map((name) => fs.readFileSync(path.join(projectRoot, name), "utf8"))
  .join("\n");
vm.runInNewContext(sources, sandbox, { filename: "info-smoke.vm.js" });

const unresolved = nodes.filter((node) => node.textContent === "—" || node.textContent === "").map((node) => node.dataset.infoRule);
if (unresolved.length > 0) throw new Error(`Unresolved Info rule values: ${unresolved.join(", ")}`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(versionNode.textContent)) throw new Error("Info documentation version is missing or invalid.");

console.log(JSON.stringify({ documentedRuleValues: nodes.length, documentationVersion: versionNode.textContent }));
