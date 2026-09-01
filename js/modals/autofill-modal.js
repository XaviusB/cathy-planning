import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { showModal, closeAllModals } from './modal.js';
import { uid, showToast } from '../utils/dom.js';
import { getWeekStart, addDays, formatDate, timeToMin, minToTime } from '../utils/date.js';

export function autoFillWeek() {
  showModal('autofill-modal');
}

export function confirmAutoFill() {
  const afStart = document.getElementById('af-start').value;
  const afEnd = document.getElementById('af-end').value;
  const duration = Number(document.getElementById('af-duration').value);
  const title = document.getElementById('af-title').value.trim() || 'Disponible';
  const checkedDays = Array.from(
    document.querySelectorAll('#af-days input:checked'),
  ).map((cb) => Number(cb.value));

  if (!afStart || !afEnd || duration < 15) {
    showToast('Paramètres invalides', 'error');
    return;
  }
  if (timeToMin(afEnd) <= timeToMin(afStart)) {
    showToast("L'heure de fin doit être après l'heure de début", 'error');
    return;
  }

  const ws = getWeekStart(state.currentDate);
  let added = 0;

  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    if (!checkedDays.includes(day.getDay())) continue;
    const dateStr = formatDate(day);

    const existing = state.slots
      .filter((s) => s.date === dateStr)
      .map((s) => ({ start: timeToMin(s.start), end: timeToMin(s.end) }));
    existing.sort((a, b) => a.start - b.start);

    let cursor = timeToMin(afStart);
    const endMin = timeToMin(afEnd);

    while (cursor + duration <= endMin) {
      const slotEnd = cursor + duration;
      const conflict = existing.some((e) => cursor < e.end && slotEnd > e.start);
      if (!conflict) {
        state.slots.push({
          id: uid(),
          title,
          date: dateStr,
          start: minToTime(cursor),
          end: minToTime(slotEnd),
          color: '#94a3b8',
          notes: '',
          userIds: [],
        });
        added++;
        existing.push({ start: cursor, end: slotEnd });
        existing.sort((a, b) => a.start - b.start);
      }
      cursor += duration;
    }
  }

  saveData();
  closeAllModals();
  renderAll();
  showToast(`${added} créneau(x) ajouté(s)`);
}
