import { state, saveData, getActiveUsers } from '../state.js';
import { renderAll } from '../renderer.js';
import { showModal, closeAllModals } from './modal.js';
import { uid, escapeHtml, showToast } from '../utils/dom.js';
import { getWeekStart, addDays, formatDate, parseDate, timeToMin, minToTime } from '../utils/date.js';

const DAY_OPTIONS = [
  ['1', 'Lundi'],
  ['2', 'Mardi'],
  ['3', 'Mercredi'],
  ['4', 'Jeudi'],
  ['5', 'Vendredi'],
  ['6', 'Samedi'],
  ['0', 'Dimanche'],
];

export function autoFillWeek() {
  const start = getWeekStart(state.currentDate);
  const end = addDays(start, 41);
  const restDays = new Set(state.settings.weeklyRestDays);
  const availableDailyHours = Math.max(
    0.25,
    (timeToMin(state.settings.standardEnd) - timeToMin(state.settings.standardStart)) / 60,
  );
  const defaultDailyHours = Math.min(
    availableDailyHours,
    state.settings.standardWeeklyHours / Math.max(1, 7 - restDays.size),
  );

  document.getElementById('af-start-date').value = formatDate(start);
  document.getElementById('af-end-date').value = formatDate(end);
  document.getElementById('af-start').value = state.settings.standardStart;
  document.getElementById('af-end').value = state.settings.standardEnd;
  document.getElementById('af-daily-hours').value = Number(defaultDailyHours.toFixed(2));
  document.getElementById('af-duration').value = 60;
  document.getElementById('af-weekly-rest-hours').value = state.settings.weeklyRestHours;
  document.getElementById('af-title').value = 'Disponible';

  document.querySelectorAll('#af-days input').forEach((input) => {
    input.checked = !restDays.has(Number(input.value)) && Number(input.value) >= 1 && Number(input.value) <= 5;
  });
  document.querySelectorAll('#af-rest-days input').forEach((input) => {
    input.checked = restDays.has(Number(input.value));
  });
  const activeUsers = getActiveUsers();
  document.getElementById('af-assignment').value = activeUsers.length ? 'balanced' : 'none';
  renderUserChoices(activeUsers);

  showModal('autofill-modal');
}

export function confirmAutoFill() {
  const startDateStr = document.getElementById('af-start-date').value;
  const endDateStr = document.getElementById('af-end-date').value;
  const afStart = document.getElementById('af-start').value;
  const afEnd = document.getElementById('af-end').value;
  const dailyHours = Number(document.getElementById('af-daily-hours').value);
  const duration = Number(document.getElementById('af-duration').value);
  const weeklyRestHours = Number(document.getElementById('af-weekly-rest-hours').value);
  const title = document.getElementById('af-title').value.trim() || 'Disponible';
  const assignmentMode = document.getElementById('af-assignment').value;
  const selectedUserIds = new Set(
    Array.from(document.querySelectorAll('#af-users input:checked')).map((input) => input.value),
  );
  const workDays = new Set(
    Array.from(document.querySelectorAll('#af-days input:checked')).map((input) => Number(input.value)),
  );
  const restDays = new Set(
    Array.from(document.querySelectorAll('#af-rest-days input:checked')).map((input) => Number(input.value)),
  );

  const startDate = parseDate(startDateStr);
  const endDate = parseDate(endDateStr);
  const startMin = timeToMin(afStart);
  const endMin = timeToMin(afEnd);
  const dailyMinutes = Math.round(dailyHours * 60);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate > endDate
  ) {
    showToast('La date de fin doit être postérieure ou égale à la date de début', 'error');
    return;
  }
  if (!afStart || !afEnd || endMin <= startMin) {
    showToast("L'heure de fin doit être après l'heure de début", 'error');
    return;
  }
  if (!Number.isFinite(dailyHours) || dailyHours <= 0 || dailyMinutes > endMin - startMin) {
    showToast("Le nombre d'heures par jour dépasse la plage horaire choisie", 'error');
    return;
  }
  if (!Number.isInteger(duration) || duration < 15 || duration > dailyMinutes) {
    showToast("La durée d'un créneau doit être inférieure aux heures à planifier par jour", 'error');
    return;
  }
  if (!Number.isFinite(weeklyRestHours) || weeklyRestHours < 35 || weeklyRestHours > 168) {
    showToast('Le repos hebdomadaire doit être compris entre 35 et 168 heures', 'error');
    return;
  }
  if (!workDays.size || [...workDays].every((day) => restDays.has(day))) {
    showToast('Sélectionnez au moins un jour à planifier qui ne soit pas un jour de repos', 'error');
    return;
  }
  if (!hasWeeklyRestWindow(workDays, restDays, startMin, endMin, weeklyRestHours)) {
    showToast(
      'Les jours et horaires choisis ne garantissent pas le repos hebdomadaire minimum',
      'error',
    );
    return;
  }

  const users = getActiveUsers().filter((user) => selectedUserIds.has(user.id));
  if (assignmentMode === 'balanced' && !users.length) {
    showToast('Sélectionnez au moins un utilisateur ou choisissez des créneaux non assignés', 'error');
    return;
  }

  const existingByDate = buildExistingIntervals();
  const userWorkloads = buildUserWorkloads(users);
  let added = 0;
  let skippedCapacity = 0;

  for (let day = new Date(startDate); day <= endDate; day = addDays(day, 1)) {
    if (!workDays.has(day.getDay()) || restDays.has(day.getDay())) continue;

    const dateStr = formatDate(day);
    const existing = existingByDate.get(dateStr) || [];
    let cursor = startMin;
    let filledMinutes = 0;

    while (filledMinutes + duration <= dailyMinutes && cursor + duration <= endMin) {
      const slotEnd = cursor + duration;
      const conflict = existing.some((interval) => cursor < interval.end && slotEnd > interval.start);
      if (!conflict) {
        const user = assignmentMode === 'balanced'
          ? chooseUser(users, userWorkloads, dateStr, cursor, slotEnd, weeklyRestHours)
          : null;

        if (assignmentMode === 'balanced' && !user) {
          skippedCapacity++;
        } else {
          state.slots.push({
            id: uid(),
            title,
            date: dateStr,
            start: minToTime(cursor),
            end: minToTime(slotEnd),
            color: '#94a3b8',
            notes: '',
            userIds: user ? [user.id] : [],
          });
          existing.push({ start: cursor, end: slotEnd });
          filledMinutes += duration;
          added++;
          if (user) recordWorkload(userWorkloads, user.id, dateStr, cursor, slotEnd);
        }
      }
      cursor += duration;
    }
    existingByDate.set(dateStr, existing);
  }

  saveData();
  closeAllModals();
  renderAll();
  const capacityMessage = skippedCapacity
    ? `, ${skippedCapacity} créneau(x) non attribué(s) faute de capacité`
    : '';
  showToast(`${added} créneau(x) ajouté(s)${capacityMessage}`);
}

function buildExistingIntervals() {
  const intervalsByDate = new Map();
  state.slots.forEach((slot) => {
    if (!intervalsByDate.has(slot.date)) intervalsByDate.set(slot.date, []);
    intervalsByDate.get(slot.date).push({
      start: timeToMin(slot.start),
      end: timeToMin(slot.end),
    });
  });
  return intervalsByDate;
}

function buildUserWorkloads(users) {
  const workloads = new Map();
  users.forEach((user) => {
    workloads.set(user.id, {
      totalMinutes: 0,
      dailyMinutes: new Map(),
      weeklyMinutes: new Map(),
    });
  });

  state.slots.forEach((slot) => {
    const start = timeToMin(slot.start);
    const end = timeToMin(slot.end);
    (slot.userIds || []).forEach((userId) => {
      if (!workloads.has(userId)) return;
      recordWorkload(workloads, userId, slot.date, start, end);
    });
  });
  return workloads;
}

function recordWorkload(workloads, userId, dateStr, start, end) {
  const workload = workloads.get(userId);
  if (!workload) return;
  const duration = end - start;
  const weekKey = formatDate(getWeekStart(parseDate(dateStr)));
  workload.totalMinutes += duration;
  workload.dailyMinutes.set(dateStr, (workload.dailyMinutes.get(dateStr) || 0) + duration);
  workload.weeklyMinutes.set(weekKey, (workload.weeklyMinutes.get(weekKey) || 0) + duration);
}

function chooseUser(users, workloads, dateStr, start, end, weeklyRestHours) {
  const duration = end - start;
  const weekKey = formatDate(getWeekStart(parseDate(dateStr)));
  const eligible = users.filter((user) => {
    const workload = workloads.get(user.id);
    const maxDaily = positiveLimit(user.maxDaily);
    const maxWeekly = Math.min(positiveLimit(user.maxHours), 168 - weeklyRestHours);
    const dailyMinutes = workload.dailyMinutes.get(dateStr) || 0;
    const weeklyMinutes = workload.weeklyMinutes.get(weekKey) || 0;
    return dailyMinutes + duration <= maxDaily * 60 && weeklyMinutes + duration <= maxWeekly * 60;
  });

  eligible.sort((a, b) => {
    const aWorkload = workloads.get(a.id);
    const bWorkload = workloads.get(b.id);
    const weeklyDifference =
      (aWorkload.weeklyMinutes.get(weekKey) || 0) - (bWorkload.weeklyMinutes.get(weekKey) || 0);
    if (weeklyDifference !== 0) return weeklyDifference;
    return aWorkload.totalMinutes - bWorkload.totalMinutes;
  });
  return eligible[0] || null;
}

function positiveLimit(value) {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
}

function hasWeeklyRestWindow(workDays, restDays, startMin, endMin, weeklyRestHours) {
  const scheduledDays = new Set([...workDays].filter((day) => !restDays.has(day)));
  const intervals = [];

  for (let dayOffset = -7; dayOffset <= 14; dayOffset++) {
    const dayOfWeek = ((dayOffset % 7) + 7) % 7;
    if (!scheduledDays.has(dayOfWeek)) continue;
    intervals.push({
      start: dayOffset * 24 * 60 + startMin,
      end: dayOffset * 24 * 60 + endMin,
    });
  }

  let longestRest = 0;
  for (let index = 1; index < intervals.length; index++) {
    longestRest = Math.max(longestRest, intervals[index].start - intervals[index - 1].end);
  }
  return longestRest >= weeklyRestHours * 60;
}

function renderUserChoices(users) {
  const container = document.getElementById('af-users');
  if (!users.length) {
    container.innerHTML = '<span class="autofill-empty">Aucun utilisateur actif</span>';
    return;
  }
  container.innerHTML = users
    .map(
      (user) => `
        <label>
          <input type="checkbox" value="${escapeHtml(user.id)}" checked />
          ${escapeHtml(user.name)}
        </label>`,
    )
    .join('');
}
