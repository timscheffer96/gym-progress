"use strict";

const summaryStartDate = document.querySelector("#summary-start-date");
const summaryEndDate = document.querySelector("#summary-end-date");
const summaryContent = document.querySelector("#summary-content");
const noSummaryImport = document.querySelector("#no-import");
const summaryStatus = document.querySelector("#summary-status");
const comparisonDescription = document.querySelector("#comparison-description");
const deloadDescription = document.querySelector("#deload-description");
const bodyMap = document.querySelector("#body-map");
const bodyMapStatus = document.querySelector("#body-map-status");
const periodPresetButtons = document.querySelectorAll("[data-period]");
const volumeMuscleSelect = document.querySelector("#volume-muscle-select");
const volumeStatSelect = document.querySelector("#volume-stat-select");
const volumeChartValue = document.querySelector("#volume-chart-value");
const volumeLineChart = document.querySelector("#volume-line-chart");
const volumeLineLegend = document.querySelector("#volume-line-legend");
const volumeLineTooltip = document.querySelector("#volume-line-tooltip");
const comparisonMuscleSelect = document.querySelector("#comparison-muscle-select");
const comparisonStatSelect = document.querySelector("#comparison-stat-select");
const comparisonChartValue = document.querySelector("#comparison-chart-value");
const comparisonLineChart = document.querySelector("#comparison-line-chart");
const comparisonLineTooltip = document.querySelector("#comparison-line-tooltip");
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
  volumeMuscleSelect.addEventListener("change", renderSummary);
  volumeStatSelect.addEventListener("change", renderSummary);
  comparisonMuscleSelect.addEventListener("change", renderSummary);
  comparisonStatSelect.addEventListener("change", renderSummary);
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
  const weeklyVolume = getWeeklyMuscleVolume(startDate, endDate);
  const deload = getMostRecentDeload(summaryRows, endDate);

  summaryStatus.textContent = `${startDate} to ${endDate}`;
  summaryPeriodPresets?.updateButtonState();
  document.querySelector("#session-count").textContent = getSessionCount(periodRows);
  document.querySelector("#period-week-count").textContent = numberOfWeeksInSummaryPeriod(startDate, endDate).toFixed(1);
  document.querySelector("#deload-weeks").textContent = deload ? deload.weeksSince : "—";
  renderVolumeChart(volume, weeksInPeriod, weeklyVolume);
  renderBodyMap(volume, weeksInPeriod);
  renderFourWeekComparison(startDate, endDate, weeklyVolume);
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

function renderVolumeChart(volume, weeksInPeriod, weeklyVolume) {
  const muscles = [...volume.keys()].sort();
  setMuscleOptions(volumeMuscleSelect, muscles, true);
  const statistic = volumeStatSelect.value;
  const selectedMuscles = [...volumeMuscleSelect.selectedOptions].map((option) => option.value);
  const entries = muscles.map((muscle) => ({ muscle, value: getVolumeStatistic(volume.get(muscle), weeksInPeriod, statistic) }));
  const selectedValues = selectedMuscles.map((muscle) => {
    const value = entries.find((entry) => entry.muscle === muscle)?.value ?? 0;
    return `${muscle}: ${formatSetValue(value, statistic)}`;
  });
  volumeChartValue.textContent = selectedValues.join(" · ");
  const series = selectedMuscles.map((muscle) => ({ name: muscle, points: getWeeklySeries(weeklyVolume, muscle, statistic) }));
  renderLineLegend(series);
  renderWeeklyLineChart(volumeLineChart, series, "Selected muscle weekly volume trend", volumeLineTooltip, statistic);
}

function renderFourWeekComparison(startDate, endDate, weeklyVolume) {
  const latestStart = dateDaysBeforeSummary(endDate, 27);
  const priorEnd = dateDaysBeforeSummary(latestStart, 1);
  const priorStart = dateDaysBeforeSummary(priorEnd, 27);

  const recentVolume = getMuscleVolume(summaryRows.filter((row) => isInSummaryPeriod(row.Date, latestStart, endDate)));
  const priorVolume = getMuscleVolume(summaryRows.filter((row) => isInSummaryPeriod(row.Date, priorStart, priorEnd)));
  const muscles = [...new Set([...recentVolume.keys(), ...priorVolume.keys()])].sort();
  comparisonDescription.textContent = `${latestStart} to ${endDate} compared with ${priorStart} to ${priorEnd}. This comparison always uses the eight weeks ending on your selected end date. Total volume is direct sets plus half of indirect sets.`;
  setMuscleOptions(comparisonMuscleSelect, muscles);
  const muscle = comparisonMuscleSelect.value;
  const statistic = comparisonStatSelect.value;
  const prior = getVolumeStatistic(priorVolume.get(muscle), 4, statistic);
  const recent = getVolumeStatistic(recentVolume.get(muscle), 4, statistic);
  const change = recent - prior;
  comparisonChartValue.textContent = `${muscle}: latest ${formatSetValue(recent, statistic)} · prior ${formatSetValue(prior, statistic)} · ${change >= 0 ? "+" : ""}${formatSetValue(change, statistic)}`;
  renderWeeklyLineChart(comparisonLineChart, [{ name: muscle, points: getWeeklySeries(weeklyVolume, muscle, statistic) }], `${muscle} selected-period comparison trend`, comparisonLineTooltip, statistic);
}

function getWeeklyMuscleVolume(startDate, endDate) {
  const weeks = getSummaryWeeks(startDate, endDate);
  const weeklyVolume = new Map(weeks.map((week) => [week, new Map()]));

  for (const row of summaryRows) {
    if (!isInSummaryPeriod(row.Date, startDate, endDate)) {
      continue;
    }
    const mapping = exerciseMuscles[row["Exercise Name"].trim()];
    const week = getWeekStartSummary(row.Date);
    const weekVolume = weeklyVolume.get(week);
    if (!mapping || !weekVolume) {
      continue;
    }

    for (const muscle of mapping.primary) {
      const counts = weekVolume.get(muscle) ?? { direct: 0, total: 0 };
      counts.direct += 1;
      counts.total += 1;
      weekVolume.set(muscle, counts);
    }
    for (const muscle of mapping.secondary) {
      const counts = weekVolume.get(muscle) ?? { direct: 0, total: 0 };
      counts.total += 0.5;
      weekVolume.set(muscle, counts);
    }
  }

  return weeklyVolume;
}

function getSummaryWeeks(startDate, endDate) {
  const firstWeek = getWeekStartSummary(startDate);
  const lastWeek = getWeekStartSummary(endDate);
  const weeks = [];
  const cursor = new Date(`${firstWeek}T12:00:00`);
  while (cursor.toISOString().slice(0, 10) <= lastWeek) {
    weeks.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function getWeeklySeries(weeklyVolume, muscle, statistic) {
  return [...weeklyVolume.entries()].map(([week, volume]) => ({ week, value: getVolumeStatistic(volume.get(muscle), 1, statistic) }));
}

function renderLineLegend(series) {
  volumeLineLegend.replaceChildren();
  series.forEach((item, index) => {
    const legendItem = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.style.background = getSeriesColor(index);
    legendItem.append(swatch, document.createTextNode(item.name));
    volumeLineLegend.append(legendItem);
  });
}

function setMuscleOptions(select, muscles, allowMultiple = false) {
  const previousValues = allowMultiple ? [...select.selectedOptions].map((option) => option.value) : [select.value];
  select.replaceChildren();
  for (const muscle of muscles) {
    const option = document.createElement("option");
    option.value = muscle;
    option.textContent = muscle;
    select.append(option);
  }
  const selectedValues = previousValues.filter((value) => muscles.includes(value));
  const fallback = muscles.includes("chest") ? "chest" : muscles[0];
  const valuesToSelect = selectedValues.length > 0 ? selectedValues : [fallback];
  for (const option of select.options) {
    option.selected = valuesToSelect.includes(option.value);
  }
}

function getVolumeStatistic(counts, weeks, statistic) {
  const direct = counts?.direct ?? 0;
  const total = counts?.total ?? 0;
  if (statistic === "direct") return direct;
  if (statistic === "total") return total;
  if (statistic === "direct-average") return direct / weeks;
  return total / weeks;
}

function formatSetValue(value, statistic) {
  return statistic.endsWith("average") ? `${value.toFixed(1)} sets/week` : `${value.toFixed(1)} sets`;
}

function renderWeeklyLineChart(container, series, label, tooltipElement, statistic) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const width = 720;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 38, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const highest = Math.max(...series.flatMap((line) => line.points.map((point) => point.value)), 1);
  const maximum = Math.ceil(highest * 1.1);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  appendChartSvg(svg, "line", { x1: padding.left, y1: padding.top, x2: padding.left, y2: height - padding.bottom, class: "metric-chart-axis" });
  appendChartSvg(svg, "line", { x1: padding.left, y1: height - padding.bottom, x2: width - padding.right, y2: height - padding.bottom, class: "metric-chart-axis" });
  appendChartSvg(svg, "text", { x: padding.left - 7, y: padding.top + 4, class: "metric-chart-value" }, maximum.toFixed(1));
  appendChartSvg(svg, "text", { x: padding.left - 7, y: height - padding.bottom + 4, class: "metric-chart-value" }, "0");
  const weeks = series[0].points;
  appendChartSvg(svg, "text", { x: padding.left, y: height - 10, class: "metric-chart-label" }, weeks[0].week);
  appendChartSvg(svg, "text", { x: width - padding.right, y: height - 10, class: "metric-chart-label", "text-anchor": "end" }, weeks.at(-1).week);

  series.forEach((line, lineIndex) => {
    const color = getSeriesColor(lineIndex);
    const coordinates = line.points.map((point, index) => ({
      ...point,
      x: padding.left + (index / Math.max(line.points.length - 1, 1)) * plotWidth,
      y: padding.top + ((maximum - point.value) / maximum) * plotHeight,
    }));
    appendChartSvg(svg, "polyline", { points: coordinates.map(({ x, y }) => `${x},${y}`).join(" "), class: "metric-chart-line", stroke: color });
    for (const point of coordinates) {
      const circle = appendChartSvg(svg, "circle", { cx: point.x, cy: point.y, r: 4, fill: color, tabindex: 0 });
      const pointText = `${line.name} · week beginning ${point.week}: ${formatSetValue(point.value, statistic)}`;
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = pointText;
      circle.append(title);
      circle.addEventListener("mouseenter", () => { tooltipElement.textContent = pointText; });
      circle.addEventListener("focus", () => { tooltipElement.textContent = pointText; });
      circle.addEventListener("mouseleave", () => { tooltipElement.textContent = "Hover or focus a data point to see its value."; });
      circle.addEventListener("blur", () => { tooltipElement.textContent = "Hover or focus a data point to see its value."; });
    }
  });
  container.replaceChildren(svg);
}

function getSeriesColor(index) {
  return ["#3e55c7", "#d14d72", "#16815d", "#d4751e", "#7652c8", "#147a9c"][index % 6];
}

function appendChartSvg(svg, tagName, attributes, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.textContent = text;
  svg.append(element);
  return element;
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
