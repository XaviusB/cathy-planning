import { state } from './state.js';
import { MONTH_NAMES } from './constants.js';
import { getWeekStart, addDays } from './utils/date.js';
import { renderWeekView } from './views/week-view.js';
import { renderMonthView } from './views/month-view.js';
import { renderDashboard } from './dashboard.js';

export function setView(v) {
  state.view = v;
  document.getElementById('btn-week').classList.toggle('active', v === 'week');
  document.getElementById('btn-month').classList.toggle('active', v === 'month');
  document.getElementById('week-view').classList.toggle('hidden', v !== 'week');
  document.getElementById('month-view').classList.toggle('hidden', v !== 'month');
  renderCalendar();
}

export function navigate(dir) {
  if (state.view === 'week') {
    state.currentDate = addDays(state.currentDate, dir * 7);
  } else {
    state.currentDate = new Date(
      state.currentDate.getFullYear(),
      state.currentDate.getMonth() + dir,
      1,
    );
  }
  renderCalendar();
}

export function goToToday() {
  state.currentDate = new Date();
  renderCalendar();
}

function updatePeriodLabel() {
  const el = document.getElementById('current-period');
  if (state.view === 'week') {
    const ws = getWeekStart(state.currentDate);
    const we = addDays(ws, 6);
    if (ws.getMonth() === we.getMonth()) {
      el.textContent = `${ws.getDate()} – ${we.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`;
    } else {
      el.textContent = `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${ws.getFullYear()}`;
    }
  } else {
    el.textContent = `${MONTH_NAMES[state.currentDate.getMonth()]} ${state.currentDate.getFullYear()}`;
  }
}

export function renderCalendar() {
  updatePeriodLabel();
  if (state.view === 'week') {
    renderWeekView();
  } else {
    renderMonthView();
  }
  renderDashboard();
}
