import { state, saveDashboardRange } from '../state.js';
import { MONTH_NAMES } from '../constants.js';
import { addDays, formatDate, getWeekStart, parseDate, sameDay } from '../utils/date.js';
import { showModal, closeAllModals } from './modal.js';
import { renderDashboard } from '../dashboard.js';

// Temporary selection state while the modal is open (not committed until "Appliquer")
let selection = { start: null, end: null };
let baseMonthOffset = 0; // 0 = current month, shifts when navigating with ‹ / ›

export function openDateRangeModal() {
  selection = state.dashboardRange
    ? {
      start: normalizeDateToWeekStart(state.dashboardRange.start),
      end: normalizeDateToWeekEnd(state.dashboardRange.end),
    }
    : { start: null, end: null };
  baseMonthOffset = 0;
  showModal('date-range-modal');
  renderDateRangeCalendars();
}

export function resetDateRangeSelection() {
  selection = { start: null, end: null };
  renderDateRangeCalendars();
}

export function navigateDateRangeMonths(dir) {
  baseMonthOffset += dir;
  renderDateRangeCalendars();
}

export function selectDateRangeDay(dateStr) {
  const weekStart = normalizeDateToWeekStart(dateStr);
  if (!selection.start || (selection.start && selection.end)) {
    // Starting a fresh selection
    selection = { start: weekStart, end: null };
  } else if (weekStart < selection.start) {
    // Clicked before the current start: make it the new start
    selection = { start: weekStart, end: null };
  } else {
    selection.end = normalizeDateToWeekEnd(dateStr);
  }
  renderDateRangeCalendars();
}

export function applyDateRange() {
  if (!selection.start) return;
  const end = selection.end || selection.start;
  state.dashboardRange = { start: selection.start, end };
  saveDashboardRange();
  closeAllModals();
  renderDashboard();
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  return cells;
}

function renderDateRangeCalendars() {
  const container = document.getElementById('date-range-calendars');
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + baseMonthOffset, 1);

  let html = `<div class="date-range-nav">
    <button type="button" class="btn btn-secondary btn-sm" onclick="navigateDateRangeMonths(-1)">‹</button>
    <span class="date-range-nav-label">Naviguer entre les mois</span>
    <button type="button" class="btn btn-secondary btn-sm" onclick="navigateDateRangeMonths(1)">›</button>
  </div>
  <div class="date-range-months">`;

  for (let m = 0; m < 2; m++) {
    const year = base.getFullYear();
    const month = base.getMonth() + m;
    const monthDate = new Date(year, month, 1);
    const cells = buildMonthGrid(monthDate.getFullYear(), monthDate.getMonth());

    html += `<div class="date-range-month">
      <div class="date-range-month-title">${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}</div>
      <div class="date-range-weekdays">
        ${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => `<span>${d}</span>`).join('')}
      </div>
      <div class="date-range-days">`;

    cells.forEach((cellDate) => {
      if (!cellDate) {
        html += `<span class="date-range-day empty"></span>`;
        return;
      }
      const dateStr = formatDate(cellDate);
      const isToday = sameDay(cellDate, today);
      let cls = 'date-range-day';
      if (isToday) cls += ' today';
      if (selection.start && dateStr === selection.start) cls += ' range-start';
      if (selection.end && dateStr === selection.end) cls += ' range-end';
      if (
        selection.start &&
        selection.end &&
        dateStr > selection.start &&
        dateStr < selection.end
      ) {
        cls += ' in-range';
      }
      if (selection.start && !selection.end && dateStr === selection.start) cls += ' in-range';

      const todayLabel = isToday ? ' title="Aujourd\'hui" aria-current="date"' : '';
      html += `<span class="${cls}"${todayLabel} onclick="selectDateRangeDay('${dateStr}')">${cellDate.getDate()}</span>`;
    });

    html += `</div></div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  const summary = document.getElementById('date-range-summary');
  const applyBtn = document.getElementById('date-range-apply-btn');
  if (selection.start && selection.end) {
    summary.textContent = `Du ${formatHuman(selection.start)} au ${formatHuman(selection.end)}`;
    applyBtn.disabled = false;
  } else if (selection.start) {
    summary.textContent = `Début : ${formatHuman(selection.start)} — choisissez la date de fin`;
    applyBtn.disabled = true;
  } else {
    summary.textContent = '';
    applyBtn.disabled = true;
  }
}

function formatHuman(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function normalizeDateToWeekStart(dateStr) {
  return formatDate(getWeekStart(parseDate(dateStr)));
}

function normalizeDateToWeekEnd(dateStr) {
  return formatDate(addDays(getWeekStart(parseDate(dateStr)), 6));
}
