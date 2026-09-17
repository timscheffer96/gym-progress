"use strict";

const summaryStartDate = document.querySelector("#summary-start-date");
const summaryEndDate = document.querySelector("#summary-end-date");
const summaryContent = document.querySelector("#summary-content");
const noSummaryImport = document.querySelector("#no-import");
const summaryStatus = document.querySelector("#summary-status");
const volumeTableBody = document.querySelector("#volume-table-body");
const comparisonTableBody = document.querySelector("#comparison-table-body");
const comparisonDescription = document.querySelector("#comparison-description");
const prTableBody = document.querySelector("#pr-table-body");
const deloadDescription = document.querySelector("#deload-description");
const bodyMap = document.querySelector("#body-map");
const bodyMapStatus = document.querySelector("#body-map-status");
const periodPresetButtons = document.querySelectorAll("[data-period]");
let summaryRows = [];
let bodyMapAverages = new Map();
let summaryPeriodPresets;

initialiseSummaryPage();
initialiseBodyMap();

function initialiseSummaryPage() {
  summaryRows = loadImportedRows();

  if (summaryRows.length === 0) {
    noSummaryImport.hidden = false;
    return;
  }

  const dates = summaryRows.map((row) => row.Date.slice(0, 10)).filter(Boolean).sort();
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  for (const input of [summaryStartDate, summaryEndDate]) {
    input.min = firstDate;
    input.max = lastDate;
  }
  summaryEndDate.value = lastDate;
  summaryStartDate.value = [firstDate, dateDaysBeforeSummary(lastDate, 83)].sort().at(-1);
  summaryStartDate.addEventListener("change", renderSummary);
  summaryEndDate.addEventListener("change", renderSummary);
  summaryPeriodPresets = createPeriodPresetController({
    buttons: periodPresetButtons,
    startInput: summaryStartDate,
    endInput: summaryEndDate,
    earliestDate: firstDate,
    latestDate: lastDate,
    onPeriodChange: renderSummary,
  });
  summaryContent.hidden = false;
  renderSummary();
}

function renderSummary() {
  const startDate = summaryStartDate.value;
  const endDate = summaryEndDate.value;

  if (startDate > endDate) {
    summaryStatus.textContent = "The start date must be on or before the end date.";
    return;
  }

  const periodRows = summaryRows.filter((row) => isInSummaryPeriod(row.Date, startDate, endDate));
  const volume = getMuscleVolume(periodRows);
  const weeksInPeriod = numberOfWeeksInSummaryPeriod(startDate, endDate);
  const prs = getEstimatedOneRmPrs(summaryRows, startDate, endDate);
  const deload = getMostRecentDeload(summaryRows, endDate);

  summaryStatus.textContent = `${startDate} to ${endDate}`;
  summaryPeriodPresets?.updateButtonState();
  document.querySelector("#session-count").textContent = getSessionCount(periodRows);
  document.querySelector("#period-week-count").textContent = numberOfWeeksInSummaryPeriod(startDate, endDate).toFixed(1);
  document.querySelector("#pr-count").textContent = prs.length;
  document.querySelector("#deload-weeks").textContent = deload ? deload.weeksSince : "—";
  renderVolumeTable(volume, weeksInPeriod);
  renderBodyMap(volume, weeksInPeriod);
  renderFourWeekComparison(endDate);
  renderPrTable(prs, startDate, endDate);
  renderDeload(deload);
}

function initialiseBodyMap() {
  for (const region of bodyMap.querySelectorAll("[data-muscle]")) {
    region.setAttribute("tabindex", "0");
    region.addEventListener("mouseenter", () => showBodyMapValue(region.dataset.muscle));
    region.addEventListener("focus", () => showBodyMapValue(region.dataset.muscle));
    region.addEventListener("mouseleave", clearBodyMapValue);
    region.addEventListener("blur", clearBodyMapValue);
  }
}

function renderBodyMap(volume, weeksInPeriod) {
  bodyMapAverages = new Map([...volume.entries()].map(([muscle, counts]) => [muscle, counts.total / weeksInPeriod]));
  const maximum = Math.max(...bodyMapAverages.values(), 1);

  for (const region of bodyMap.querySelectorAll("[data-muscle]")) {
    const muscle = region.dataset.muscle;
    const average = bodyMapAverages.get(muscle) ?? 0;
    const intensity = average / maximum;
    const lightness = 90 - intensity * 45;
    region.style.fill = `hsl(230 64% ${lightness}%)`;
    region.setAttribute("aria-label", `${muscle}: ${average.toFixed(1)} average total sets per week`);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${muscle}: ${average.toFixed(1)} average total sets per week`;
    region.replaceChildren(title);
  }
}

function showBodyMapValue(muscle) {
  const average = bodyMapAverages.get(muscle) ?? 0;
  bodyMapStatus.textContent = `${muscle}: ${average.toFixed(1)} average total sets per week.`;
  for (const region of bodyMap.querySelectorAll("[data-muscle]")) {
    region.classList.toggle("is-highlighted", region.dataset.muscle === muscle);
  }
}

function clearBodyMapValue() {
  bodyMapStatus.textContent = "Hover or focus a muscle region to see its average total sets per week.";
  for (const region of bodyMap.querySelectorAll("[data-muscle]")) {
    region.classList.remove("is-highlighted");
  }
}

function getSessionCount(rows) {
  return new Set(rows.map((row) => `${row.Date}-${row["Workout #"]}`)).size;
}

function getMuscleVolume(rows) {
  const volume = new Map();

  for (const row of rows) {
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];
    if (!mapping) {
      continue;
    }

    for (const muscle of mapping.primary) {
      const counts = volume.get(muscle) ?? { direct: 0, total: 0 };
      counts.direct += 1;
      counts.total += 1;
      volume.set(muscle, counts);
    }
    for (const muscle of mapping.secondary) {
      const counts = volume.get(muscle) ?? { direct: 0, total: 0 };
      counts.total += 0.5;
      volume.set(muscle, counts);
    }
  }

  return volume;
}

function renderVolumeTable(volume, weeksInPeriod) {
  volumeTableBody.replaceChildren();
  const entries = [...volume.entries()].sort(([, first], [, second]) => second.total - first.total);

  for (const [muscle, counts] of entries) {
    appendSummaryRow(volumeTableBody, [muscle, counts.direct, counts.total.toFixed(1), (counts.direct / weeksInPeriod).toFixed(1), (counts.total / weeksInPeriod).toFixed(1)]);
  }
}

function renderFourWeekComparison(endDate) {
  comparisonTableBody.replaceChildren();
  const latestStart = dateDaysBeforeSummary(endDate, 27);
  const priorEnd = dateDaysBeforeSummary(latestStart, 1);
  const priorStart = dateDaysBeforeSummary(priorEnd, 27);

  const recentVolume = getMuscleVolume(summaryRows.filter((row) => isInSummaryPeriod(row.Date, latestStart, endDate)));
  const priorVolume = getMuscleVolume(summaryRows.filter((row) => isInSummaryPeriod(row.Date, priorStart, priorEnd)));
  const muscles = [...new Set([...recentVolume.keys(), ...priorVolume.keys()])].sort((first, second) => (recentVolume.get(second)?.total ?? 0) - (recentVolume.get(first)?.total ?? 0));
  comparisonDescription.textContent = `${latestStart} to ${endDate} compared with ${priorStart} to ${priorEnd}. This comparison always uses the eight weeks ending on your selected end date. Total volume is direct sets plus half of indirect sets.`;

  for (const muscle of muscles) {
    const recent = recentVolume.get(muscle)?.total ?? 0;
    const prior = priorVolume.get(muscle)?.total ?? 0;
    const change = recent - prior;
    appendSummaryRow(comparisonTableBody, [muscle, recent.toFixed(1), (recent / 4).toFixed(1), prior.toFixed(1), (prior / 4).toFixed(1), `${change >= 0 ? "+" : ""}${change.toFixed(1)}`]);
  }
}

function getEstimatedOneRmPrs(rows, startDate, endDate) {
  const priorBest = new Map();
  const periodBest = new Map();

  for (const row of rows) {
    const estimate = estimateOneRm(row);
    if (estimate === null) {
      continue;
    }
    const exercise = row["Exercise Name"].trim();
    const date = row.Date.slice(0, 10);

    if (date < startDate) {
      priorBest.set(exercise, Math.max(priorBest.get(exercise) ?? 0, estimate));
    } else if (date <= endDate) {
      const current = periodBest.get(exercise);
      if (!current || estimate > current.estimate) {
        periodBest.set(exercise, { date, estimate });
      }
    }
  }

  return [...periodBest.entries()]
    .filter(([exercise, result]) => priorBest.has(exercise) && result.estimate > priorBest.get(exercise))
    .map(([exercise, result]) => ({ exercise, ...result, previous: priorBest.get(exercise), improvement: result.estimate - priorBest.get(exercise) }))
    .sort((first, second) => second.improvement - first.improvement)
    .slice(0, 10);
}

function renderPrTable(prs, startDate, endDate) {
  prTableBody.replaceChildren();
  if (prs.length === 0) {
    appendSummaryRow(prTableBody, ["No estimated-1RM PRs in this period", "—", "—", "—", "—"]);
    return;
  }

  for (const pr of prs) {
    const row = document.createElement("tr");
    const exerciseCell = document.createElement("td");
    const liftLink = document.createElement("a");
    const trendUrl = new URL("trends.html", window.location.href);
    trendUrl.searchParams.set("lift", pr.exercise);
    trendUrl.searchParams.set("start", startDate);
    trendUrl.searchParams.set("end", endDate);
    liftLink.href = trendUrl.toString();
    liftLink.textContent = pr.exercise;
    exerciseCell.append(liftLink);
    row.append(exerciseCell);

    for (const value of [pr.date, `${pr.estimate.toFixed(1)} kg`, `${pr.previous.toFixed(1)} kg`, `+${pr.improvement.toFixed(1)} kg`]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    prTableBody.append(row);
  }
}

function getMostRecentDeload(rows, endDate) {
  const fullWeekEnd = getLastCompletedWeekStart(endDate);
  const firstWeek = getWeekStartSummary(rows.map((row) => row.Date).filter(Boolean).sort()[0]);
  const weeks = [];
  const cursor = new Date(`${firstWeek}T12:00:00`);

  while (cursor.toISOString().slice(0, 10) <= fullWeekEnd) {
    weeks.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }

  const weeklyDirectSets = new Map(weeks.map((week) => [week, 0]));
  for (const row of rows) {
    const week = getWeekStartSummary(row.Date);
    if (!weeklyDirectSets.has(week) || !exerciseMuscles[row["Exercise Name"].trim()]) {
      continue;
    }
    weeklyDirectSets.set(week, weeklyDirectSets.get(week) + exerciseMuscles[row["Exercise Name"].trim()].primary.length);
  }

  let latestDeload = null;
  for (let index = 4; index < weeks.length; index += 1) {
    const precedingAverage = weeks.slice(index - 4, index).reduce((total, week) => total + weeklyDirectSets.get(week), 0) / 4;
    const currentSets = weeklyDirectSets.get(weeks[index]);
    if (currentSets > 0 && precedingAverage > 0 && currentSets <= precedingAverage * 0.5) {
      latestDeload = weeks[index];
    }
  }

  if (!latestDeload) {
    return null;
  }

  return {
    week: latestDeload,
    weeksSince: Math.round((new Date(`${fullWeekEnd}T12:00:00`) - new Date(`${latestDeload}T12:00:00`)) / 604_800_000),
  };
}

function renderDeload(deload) {
  deloadDescription.textContent = deload
    ? `Most recent qualifying deload: week beginning ${deload.week} (${deload.weeksSince} full week${deload.weeksSince === 1 ? "" : "s"} ago). A qualifying deload is a completed Monday–Sunday week with logged training at or below 50% of the prior four completed weeks' average direct hard-set count.`
    : "No qualifying full deload week was found before the selected end date. A qualifying deload is a completed Monday–Sunday week with logged training at or below 50% of the prior four completed weeks' average direct hard-set count.";
}

function appendSummaryRow(tableBody, values) {
  const row = document.createElement("tr");
  for (const value of values) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.append(cell);
  }
  tableBody.append(row);
}

function estimateOneRm(row) {
  const weight = Number(row["Weight (kg)"]);
  const reps = Number(row.Reps);
  return Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0 ? weight * (1 + reps / 30) : null;
}

function getWeekStartSummary(dateTime) {
  const date = new Date(`${dateTime.slice(0, 10)}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
}

function getLastCompletedWeekStart(endDate) {
  const date = new Date(`${endDate}T12:00:00`);
  const weekStart = getWeekStartSummary(endDate);
  if (date.getDay() === 0) {
    return weekStart;
  }
  const previousWeek = new Date(`${weekStart}T12:00:00`);
  previousWeek.setDate(previousWeek.getDate() - 7);
  return previousWeek.toISOString().slice(0, 10);
}

function numberOfWeeksInSummaryPeriod(startDate, endDate) {
  return (new Date(`${endDate}T12:00:00`) - new Date(`${startDate}T12:00:00`) + 86_400_000) / 604_800_000;
}

function isInSummaryPeriod(dateTime, startDate, endDate) {
  const date = dateTime.slice(0, 10);
  return date >= startDate && date <= endDate;
}

function dateDaysBeforeSummary(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
