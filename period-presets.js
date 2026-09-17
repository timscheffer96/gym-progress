"use strict";

// Shared quick period selector for every page with start and end date inputs.
function createPeriodPresetController({ buttons, startInput, endInput, earliestDate, latestDate, onPeriodChange }) {
  function getPresetStartDate(preset) {
    let startDate = latestDate;

    if (preset === "4-weeks") {
      startDate = dateDaysBeforePreset(latestDate, 27);
    } else if (preset === "12-weeks") {
      startDate = dateDaysBeforePreset(latestDate, 83);
    } else if (preset === "6-months") {
      startDate = dateMonthsBeforePreset(latestDate, 6);
    } else if (preset === "1-year") {
      startDate = dateMonthsBeforePreset(latestDate, 12);
    }

    return [earliestDate, startDate].sort().at(-1);
  }

  function updateButtonState() {
    for (const button of buttons) {
      const isSelected = startInput.value === getPresetStartDate(button.dataset.period) && endInput.value === latestDate;
      button.setAttribute("aria-pressed", String(isSelected));
    }
  }

  for (const button of buttons) {
    button.addEventListener("click", () => {
      endInput.value = latestDate;
      startInput.value = getPresetStartDate(button.dataset.period);
      updateButtonState();
      onPeriodChange();
    });
  }

  return { updateButtonState };
}

function dateDaysBeforePreset(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function dateMonthsBeforePreset(dateString, months) {
  const date = new Date(`${dateString}T12:00:00`);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() - months);
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDayOfMonth));
  return date.toISOString().slice(0, 10);
}
