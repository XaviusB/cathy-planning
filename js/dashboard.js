import { state, saveDashboardRange } from './state.js';
import { MONTH_NAMES, DAY_NAMES } from './constants.js';
import { getWeekStart, addDays, formatDate, slotDurationMin, timeToMin, parseDate } from './utils/date.js';
import { escapeHtml, userInitials } from './utils/dom.js';

export function renderDashboard() {
  if (state.view === 'dashboard') {
    renderDashboardTable();
    return;
  }

  const container = document.getElementById(state.view === 'dashboard' ? 'dashboard-view' : 'dashboard-content');
  if (state.users.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Ajoutez des utilisateurs pour voir les statistiques.</p>';
    return;
  }

  let ws, we, wsStr, weStr, periodLabel;
  if (state.view === 'month') {
    ws = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
    we = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 0);
  } else {
    ws = getWeekStart(state.currentDate);
    we = addDays(ws, 6);
  }
  wsStr = formatDate(ws);
  weStr = formatDate(we);
  periodLabel = state.view === 'month'
    ? `${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`
    : `Semaine du ${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]}`;

  let html = `<div class="dashboard-period-label">
    <span>${periodLabel}</span>
  </div>`;

  state.users.forEach((user) => {
    const weekSlots = state.slots.filter(
      (s) => s.date >= wsStr && s.date <= weStr && (s.userIds || []).includes(user.id),
    );
    const totalSlots = state.slots.filter((s) => (s.userIds || []).includes(user.id));

    const weekHours = weekSlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;
    const totalHours = totalSlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;
    const alerts = getAlerts(user, ws, we, weekSlots);
    const pct = Math.min((weekHours / user.maxHours) * 100, 100);
    const barColor =
      weekHours > user.maxHours
        ? 'var(--danger)'
        : 'var(--success)';

    const periodStatLabel = state.view === 'month' ? 'Mois' : 'Semaine';

    html += `<div class="user-card">
      <div class="user-card-header">
        <div class="user-avatar user-drag-handle" style="background:${user.color}" data-user-id="${user.id}" title="Glisser vers le planning">${userInitials(user.name)}</div>
        <div class="user-card-name">${escapeHtml(user.name)}</div>
        <span class="user-drag-hint" title="Glisser pour créer/assigner un créneau">⠿</span>
      </div>
      <div class="user-stat"><span>${periodStatLabel}</span><span>${weekHours.toFixed(1)}h / ${user.maxHours}h</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="user-stat"><span>Total</span><span>${totalHours.toFixed(1)}h (${totalSlots.length} créneaux)</span></div>`;

    if (alerts.length > 0) {
      html +=
        `<div class="alert-list">` +
        alerts.map((a) => `<div class="alert-item alert-${a.type}">${a.msg}</div>`).join('') +
        `</div>`;
    }

    html += `</div>`;
  });

  container.innerHTML = html;
}

function renderDashboardTable() {
  const container = document.getElementById('dashboard-view');
  const { start, end } = state.dashboardRange
    ? { start: parseDate(state.dashboardRange.start), end: parseDate(state.dashboardRange.end) }
    : { start: getWeekStart(state.currentDate), end: addDays(getWeekStart(state.currentDate), 6) };
  const weeks = [];
  let weekStart = getWeekStart(start);
  while (weekStart <= end) {
    weeks.push({ start: weekStart, end: addDays(weekStart, 6) });
    weekStart = addDays(weekStart, 7);
  }

  let html = `<div class="dashboard-page-toolbar">
    <button class="btn btn-secondary" onclick="openDateRangeModal()">📊 Choisir une période</button>
  </div>
  <div class="dashboard-period-label">
    <span>${state.dashboardRange ? `Du ${formatDate(start)} au ${formatDate(end)}` : `Semaine du ${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`}</span>
    ${state.dashboardRange ? `<button type="button" class="dashboard-period-clear" onclick="clearDashboardRange()" title="Revenir à la semaine en cours">✕</button>` : ''}
  </div>`;

  if (state.users.length === 0) {
    container.innerHTML = `${html}<p style="color:var(--text-muted);font-size:13px">Ajoutez des utilisateurs pour voir les statistiques.</p>`;
    return;
  }

  html += `<div class="dashboard-table-wrapper"><table class="dashboard-table">
    <thead><tr><th>Utilisateur</th>
      ${weeks.map((week) => `<th>Semaine<br>${week.start.getDate()} ${MONTH_NAMES[week.start.getMonth()]}</th>`).join('')}
      <th>Total</th>
    </tr></thead><tbody>`;

  state.users.forEach((user) => {
    let totalHours = 0;
    html += `<tr><th scope="row"><span class="dashboard-table-user">
      <span class="user-avatar" style="background:${user.color}">${userInitials(user.name)}</span>
      ${escapeHtml(user.name)}
    </span></th>`;

    weeks.forEach((week) => {
      const rangeStart = start > week.start ? start : week.start;
      const rangeEnd = end < week.end ? end : week.end;
      const weekSlots = state.slots.filter(
        (slot) =>
          slot.date >= formatDate(rangeStart) &&
          slot.date <= formatDate(rangeEnd) &&
          (slot.userIds || []).includes(user.id),
      );
      const hours = weekSlots.reduce((total, slot) => total + slotDurationMin(slot), 0) / 60;
      totalHours += hours;
      const overLimit = hours > user.maxHours;
      const restInsufficient =
        calculateWeeklyRestHours(week.start, week.end) < state.settings.weeklyRestHours;
      html += `<td class="${overLimit ? 'dashboard-cell-danger' : ''}${restInsufficient ? ' dashboard-cell-warning' : ''}">
        <strong>${hours.toFixed(1)}h</strong> <span>/ ${user.maxHours}h</span>
        ${overLimit ? '<small>⚠️ Dépassement</small>' : ''}
        ${restInsufficient ? '<small>⚠️ Repos insuffisant</small>' : ''}
      </td>`;
    });

    html += `<td class="dashboard-table-total"><strong>${totalHours.toFixed(1)}h</strong></td></tr>`;
  });

  container.innerHTML = `${html}</tbody></table></div>`;
}

export function clearDashboardRange() {
  state.dashboardRange = null;
  saveDashboardRange();
  renderDashboard();
}

function getWeeklyRestAlerts(periodStart, periodEnd) {
  const alerts = [];
  let weekStart = getWeekStart(periodStart);
  let hasInsufficientRest = false;

  while (weekStart <= periodEnd) {
    const weekEnd = addDays(weekStart, 6);
    if (calculateWeeklyRestHours(weekStart, weekEnd) < state.settings.weeklyRestHours) {
      hasInsufficientRest = true;
      alerts.push({
        type: 'warning',
        msg: `⚠️ Repos hebdomadaire insuffisant (${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]})`,
      });
    }
    weekStart = addDays(weekStart, 7);
  }

  if (!hasInsufficientRest) {
    alerts.push({ type: 'success', msg: '✅ Repos hebdomadaire conforme' });
  }
  return alerts;
}

function calculateWeeklyRestHours(periodStart, periodEnd) {
  const periodStartMin = 0;
  const periodEndMin = ((periodEnd - periodStart) / (1000 * 60 * 60 * 24) + 1) * 24 * 60;
  const standardStart = timeToMin(state.settings.standardStart);
  const standardEnd = timeToMin(state.settings.standardEnd);
  const intervals = Array.from({ length: Math.round(periodEndMin / (24 * 60)) }, (_, dayOffset) => {
    const date = addDays(periodStart, dayOffset);
    if (state.settings.weeklyRestDays.includes(date.getDay())) return null;
    return {
      start: dayOffset * 24 * 60 + standardStart,
      end: dayOffset * 24 * 60 + standardEnd,
    };
  })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  let longestGap = 0;
  let cursor = periodStartMin;
  intervals.forEach((interval) => {
    longestGap = Math.max(longestGap, interval.start - cursor);
    cursor = Math.max(cursor, interval.end);
  });
  if (intervals.length > 0) {
    const firstStart = intervals[0].start;
    const lastEnd = intervals[intervals.length - 1].end;
    longestGap = Math.max(longestGap, firstStart + periodEndMin - lastEnd);
  } else {
    longestGap = periodEndMin;
  }
  return longestGap / 60;
}

function getAlerts(user, weekStart, weekEnd, weekSlots) {
  const alerts = [];
  const weekHours = weekSlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;
  const weeklyRestAlerts = getWeeklyRestAlerts(weekStart, weekEnd);
  alerts.push(...weeklyRestAlerts);

  if (weekHours > user.maxHours) {
    alerts.push({ type: 'danger', msg: `⚠️ Dépassement : ${weekHours.toFixed(1)}h/${user.maxHours}h` });
  }

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dayStr = formatDate(day);
    const daySlots = weekSlots.filter((s) => s.date === dayStr);
    const dayHours = daySlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;
    if (dayHours > user.maxDaily) {
      alerts.push({
        type: 'danger',
        msg: `⚠️ ${DAY_NAMES[day.getDay()]} : ${dayHours.toFixed(1)}h/${user.maxDaily}h`,
      });
    }
  }

  // Check minimum daily rest between consecutive days
  const slotsByDay = {};
  weekSlots.forEach((s) => {
    if (!slotsByDay[s.date]) slotsByDay[s.date] = [];
    slotsByDay[s.date].push(s);
  });

  const dates = Object.keys(slotsByDay).sort();
  for (let di = 0; di < dates.length - 1; di++) {
    const d1 = dates[di];
    const d2 = dates[di + 1];
    const diff = (parseDate(d2) - parseDate(d1)) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      const lastEnd = Math.max(...slotsByDay[d1].map((s) => timeToMin(s.end)));
      const firstStart = Math.min(...slotsByDay[d2].map((s) => timeToMin(s.start)));
      const restHours = (24 * 60 - lastEnd + firstStart) / 60;
      if (restHours < user.restHours) {
        alerts.push({
          type: 'warning',
          msg: `😴 Repos insuffisant : ${restHours.toFixed(1)}h/${user.restHours}h (${d1}→${d2})`,
        });
      }
    }
  }

  return alerts;
}
