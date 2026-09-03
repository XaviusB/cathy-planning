import { state, saveDashboardRange } from './state.js';
import { MONTH_NAMES, DAY_NAMES } from './constants.js';
import { getWeekStart, addDays, formatDate, slotDurationMin, timeToMin, parseDate } from './utils/date.js';
import { escapeHtml, userInitials } from './utils/dom.js';

export function renderDashboard() {
  const container = document.getElementById('dashboard-content');
  if (state.users.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-muted);font-size:13px">Ajoutez des utilisateurs pour voir les statistiques.</p>';
    return;
  }

  let ws, we, wsStr, weStr, periodLabel;
  if (state.dashboardRange) {
    wsStr = state.dashboardRange.start;
    weStr = state.dashboardRange.end;
    ws = parseDate(wsStr);
    we = parseDate(weStr);
    periodLabel = wsStr === weStr
      ? `Le ${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} ${ws.getFullYear()}`
      : `Du ${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} au ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
  } else {
    ws = getWeekStart(state.currentDate);
    we = addDays(ws, 6);
    wsStr = formatDate(ws);
    weStr = formatDate(we);
    periodLabel = `Semaine du ${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]}`;
  }

  let html = `<div class="dashboard-period-label">
    <span>${periodLabel}</span>
    ${state.dashboardRange ? `<button type="button" class="dashboard-period-clear" onclick="clearDashboardRange()" title="Revenir à la semaine en cours">✕</button>` : ''}
  </div>`;

  state.users.forEach((user) => {
    const weekSlots = state.slots.filter(
      (s) => s.date >= wsStr && s.date <= weStr && (s.userIds || []).includes(user.id),
    );
    const totalSlots = state.slots.filter((s) => (s.userIds || []).includes(user.id));

    const weekHours = weekSlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;
    const totalHours = totalSlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;
    const weeklyRestHours = calculateWeeklyRestHours(ws, we);
    const weeklyRestColor =
      weeklyRestHours >= state.settings.weeklyRestHours ? 'var(--success)' : 'var(--warning)';
    const weeklyRestPct = Math.min(
      (weeklyRestHours / state.settings.weeklyRestHours) * 100,
      100,
    );

    const alerts = getAlerts(user, ws, we, weekSlots);
    const pct = Math.min((weekHours / user.maxHours) * 100, 100);
    const barColor =
      weekHours > user.maxHours
        ? 'var(--danger)'
        : weekHours > user.maxHours * 0.85
          ? 'var(--warning)'
          : 'var(--success)';

    const periodStatLabel = state.dashboardRange ? 'Période' : 'Semaine';

    html += `<div class="user-card">
      <div class="user-card-header">
        <div class="user-avatar user-drag-handle" style="background:${user.color}" data-user-id="${user.id}" title="Glisser vers le planning">${userInitials(user.name)}</div>
        <div class="user-card-name">${escapeHtml(user.name)}</div>
        <span class="user-drag-hint" title="Glisser pour créer/assigner un créneau">⠿</span>
      </div>
      <div class="user-stat"><span>${periodStatLabel}</span><span>${weekHours.toFixed(1)}h / ${user.maxHours}h</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="user-stat">
        <span>Repos hebdomadaire</span>
        <span style="color:${weeklyRestColor}">${weeklyRestHours.toFixed(1)}h / ${state.settings.weeklyRestHours}h</span>
      </div>
      <div class="progress-bar rest-progress">
        <div class="progress-fill" style="width:${weeklyRestPct}%;background:${weeklyRestColor}"></div>
      </div>
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

export function clearDashboardRange() {
  state.dashboardRange = null;
  saveDashboardRange();
  renderDashboard();
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
  longestGap = Math.max(longestGap, periodEndMin - cursor);
  return longestGap / 60;
}

function getAlerts(user, weekStart, weekEnd, weekSlots) {
  const alerts = [];
  const weekHours = weekSlots.reduce((acc, s) => acc + slotDurationMin(s), 0) / 60;

  if (weekHours > user.maxHours) {
    alerts.push({ type: 'danger', msg: `⚠️ Dépassement : ${weekHours.toFixed(1)}h/${user.maxHours}h` });
  } else if (weekHours > user.maxHours * 0.9) {
    alerts.push({ type: 'warning', msg: `⚡ Proche limite : ${weekHours.toFixed(1)}h/${user.maxHours}h` });
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
