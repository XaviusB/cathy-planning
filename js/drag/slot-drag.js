import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { SNAP_MIN, HOUR_START, HOUR_END } from '../constants.js';
import { slotDurationMin, timeToMin, minToTime } from '../utils/date.js';
import { getContrastColor, showToast } from '../utils/dom.js';

export let dragState = null;
export let cancelDrag = null;

export function startDrag(e, slot) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();

  let grabOffsetMin = 0;
  const slotEl = e.currentTarget;
  if (slotEl) {
    const rect = slotEl.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const dur = slotDurationMin(slot);
    grabOffsetMin = Math.round((relY / rect.height) * dur / SNAP_MIN) * SNAP_MIN;
  }

  const ghost = document.getElementById('drag-ghost');
  ghost.textContent = slot.title || 'Créneau';
  ghost.style.background = slot.color || '#4f86f7';
  ghost.style.color = getContrastColor(slot.color || '#4f86f7');
  ghost.classList.remove('hidden');
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;

  dragState = { slot, grabOffsetMin };

  const orig = document.querySelector(`.slot-block[data-slot-id="${slot.id}"]`);
  if (orig) orig.classList.add('dragging');

  const onMouseMove = (ev) => {
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (target) {
      const col = target.closest('.week-day-col') || target.closest('.month-cell');
      if (col) col.classList.add('drop-target');
    }
  };

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));

    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (target && dragState) {
      let newDate = null;
      let newStartMin = null;

      if (state.view === 'week') {
        const col = target.closest('.week-day-col');
        if (col) {
          newDate = col.dataset.date;
          const rect = col.getBoundingClientRect();
          const fraction = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
          const rawMin =
            HOUR_START * 60 +
            Math.round((fraction * (HOUR_END - HOUR_START) * 60) / SNAP_MIN) * SNAP_MIN;
          newStartMin = Math.max(
            HOUR_START * 60,
            Math.min(HOUR_END * 60 - slotDurationMin(slot), rawMin - grabOffsetMin),
          );
          newStartMin = Math.round(newStartMin / SNAP_MIN) * SNAP_MIN;
        }
      } else {
        const cell = target.closest('.month-cell');
        if (cell) newDate = cell.dataset.date;
      }

      if (newDate || newStartMin !== null) {
        const slotIdx = state.slots.findIndex((s) => s.id === dragState.slot.id);
        if (slotIdx >= 0) {
          const s = state.slots[slotIdx];
          const dur = slotDurationMin(s);
          const oldDate = s.date;
          const oldStartMin = timeToMin(s.start);
          const finalDate = newDate || oldDate;
          const finalStartMin = newStartMin !== null ? newStartMin : oldStartMin;

          if (finalDate !== oldDate || Math.abs(finalStartMin - oldStartMin) >= SNAP_MIN) {
            s.date = finalDate;
            s.start = minToTime(finalStartMin);
            s.end = minToTime(finalStartMin + dur);
            saveData();
            renderAll();
            showToast('Créneau déplacé');
          }
        }
      }
    }

    document.querySelectorAll('.slot-block.dragging').forEach((el) => el.classList.remove('dragging'));
    dragState = null;
    cancelDrag = null;
  };

  cancelDrag = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    document.querySelectorAll('.slot-block.dragging').forEach((el) => el.classList.remove('dragging'));
    dragState = null;
    cancelDrag = null;
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
