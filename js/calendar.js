import { state, saveViewPreferences, saveDashboardRange } from './state.js';
import { MONTH_NAMES } from './constants.js';
import { getWeekStart, addDays } from './utils/date.js';
import { renderWeekView } from './views/week-view.js';
import { renderMonthView } from './views/month-view.js';
import { renderDashboard } from './dashboard.js';
import { escapeHtml } from './utils/dom.js';

export function setView(v) {
  state.view = v;
  saveViewPreferences();
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
  if (state.dashboardRange) {
    state.dashboardRange = null;
    saveDashboardRange();
  }
  saveViewPreferences();
  renderCalendar();
}

export function goToToday() {
  state.currentDate = new Date();
  saveViewPreferences();
  renderCalendar();
}

export function setDisplayMode(mode) {
  state.displayMode = mode === 'user' ? 'user' : 'overlap';
  if (state.displayMode === 'user' && !state.displayUserId && state.users.length) {
    state.displayUserId = state.users[0].id;
  }
  saveViewPreferences();
  renderCalendar();
}

export function setDisplayUser(userId) {
  state.displayUserId = userId || null;
  saveViewPreferences();
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
  renderDisplayControls();
  document.getElementById('btn-week').classList.toggle('active', state.view === 'week');
  document.getElementById('btn-month').classList.toggle('active', state.view === 'month');
  document.getElementById('week-view').classList.toggle('hidden', state.view !== 'week');
  document.getElementById('month-view').classList.toggle('hidden', state.view !== 'month');
  updatePeriodLabel();
  if (state.view === 'week') {
    renderWeekView();
  } else {
    renderMonthView();
  }
  renderDashboard();
}

function renderDisplayControls() {
  const mode = document.getElementById('display-mode');
  const userSelect = document.getElementById('display-user');
  const userControl = document.getElementById('display-user-control');
  if (!mode || !userSelect || !userControl) return;

  userSelect.innerHTML = state.users
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`)
    .join('');
  if (state.displayMode === 'user' && !state.users.some((user) => user.id === state.displayUserId)) {
    state.displayUserId = state.users[0]?.id || null;
  }
  mode.value = state.displayMode;
  userSelect.value = state.displayUserId || '';
  userControl.classList.toggle('hidden', state.displayMode !== 'user');
}
