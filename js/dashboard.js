import { state } from '../state.js';
import { MONTH_NAMES, DAY_NAMES } from '../constants.js';
import { getWeekStart, addDays, formatDate, slotDurationMin, timeToMin, parseDate } from '../utils/date.js';
import { escapeHtml, userInitials } from '../utils/dom.js';

export function renderDashboard() {
  const container = document.getElementById('dashboard-content');
  if (state.users.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-muted);font-size:13px">Ajoutez des utilisateurs pour voir les statistiques.</p>';
    return;
  }

  const ws = getWeekStart(state.currentDate);
  const we = addDays(ws, 6);
  const wsStr = formatDate(ws);
  const weStr = formatDate(we);

  let html = `<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
    Semaine du ${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]}
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
        : weekHours > user.maxHours * 0.85
          ? 'var(--warning)'
          : 'var(--success)';

    html += `<div class="user-card">
      <div class="user-card-header">
        <div class="user-avatar user-drag-handle" style="background:${user.color}" data-user-id="${user.id}" title="Glisser vers le planning">${userInitials(user.name)}</div>
        <div class="user-card-name">${escapeHtml(user.name)}</div>
        <span class="user-drag-hint" title="Glisser pour créer/assigner un créneau">⠿</span>
      </div>
      <div class="user-stat"><span>Semaine</span><span>${weekHours.toFixed(1)}h / ${user.maxHours}h</span></div>
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
