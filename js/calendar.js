import { state, saveViewPreferences, saveDashboardRange } from './state.js';
import { MONTH_NAMES, MONTH_VIEW_WEEKS } from './constants.js';
import { getWeekStart, addDays } from './utils/date.js';
import { renderWeekView } from './views/week-view.js';
import { renderMonthView } from './views/month-view.js';
import { renderDashboard } from './dashboard.js';
import { escapeHtml } from './utils/dom.js';

export function setView(v) {
  state.view = ['week', 'month', 'dashboard'].includes(v) ? v : 'week';
  saveViewPreferences();
  document.getElementById('btn-week').classList.toggle('active', state.view === 'week');
  document.getElementById('btn-month').classList.toggle('active', state.view === 'month');
  document.getElementById('btn-dashboard').classList.toggle('active', state.view === 'dashboard');
  document.getElementById('week-view').classList.toggle('hidden', state.view !== 'week');
  document.getElementById('month-view').classList.toggle('hidden', state.view !== 'month');
  document.getElementById('dashboard-view').classList.toggle('hidden', state.view !== 'dashboard');
  document.querySelector('.right-panel').classList.toggle('hidden', state.view === 'dashboard');
  document.querySelector('.nav-controls').classList.toggle('hidden', state.view === 'dashboard');
  document.querySelector('.display-controls').classList.toggle('hidden', state.view === 'dashboard');
  renderCalendar();
}

export function navigate(dir) {
  if (state.view === 'week') {
    state.currentDate = addDays(state.currentDate, dir * 7);
  } else if (state.view === 'month') {
    state.currentDate = addDays(state.currentDate, dir * 7);
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
  } else if (state.view === 'month') {
    const ws = getWeekStart(state.currentDate);
    const we = addDays(ws, MONTH_VIEW_WEEKS * 7 - 1);
    el.textContent = `Du ${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} au ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
  } else {
    el.textContent = 'Tableau de bord';
  }
}

export function renderCalendar() {
  renderDisplayControls();
  document.getElementById('btn-week').classList.toggle('active', state.view === 'week');
  document.getElementById('btn-month').classList.toggle('active', state.view === 'month');
  document.getElementById('btn-dashboard').classList.toggle('active', state.view === 'dashboard');
  document.getElementById('week-view').classList.toggle('hidden', state.view !== 'week');
  document.getElementById('month-view').classList.toggle('hidden', state.view !== 'month');
  document.getElementById('dashboard-view').classList.toggle('hidden', state.view !== 'dashboard');
  document.querySelector('.right-panel').classList.toggle('hidden', state.view === 'dashboard');
  document.querySelector('.nav-controls').classList.toggle('hidden', state.view === 'dashboard');
  document.querySelector('.display-controls').classList.toggle('hidden', state.view === 'dashboard');
  updatePeriodLabel();
  if (state.view === 'week') {
    renderWeekView();
  } else if (state.view === 'month') {
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
