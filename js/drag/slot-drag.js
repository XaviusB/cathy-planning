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

  const dur = slotDurationMin(slot);
  let grabOffsetMin = 0;
  const slotEl = e.currentTarget;
  const isAgendaPill = !!slotEl?.classList.contains('agenda-slot-pill');
  if (slotEl) {
    const rect = slotEl.getBoundingClientRect();
    if (isAgendaPill) {
      const relX = e.clientX - rect.left;
      grabOffsetMin = Math.round((relX / rect.width) * dur / SNAP_MIN) * SNAP_MIN;
    } else {
      const relY = e.clientY - rect.top;
      grabOffsetMin = Math.round((relY / rect.height) * dur / SNAP_MIN) * SNAP_MIN;
    }
  }

  const startX = e.clientX;
  const startY = e.clientY;
  const DRAG_THRESHOLD = 4; // px — below this, treat mouseup as a plain click (open modal)
  let hasMoved = false;

  const ghost = document.getElementById('drag-ghost');
  ghost.textContent = slot.title || 'Créneau';
  ghost.style.background = slot.color || '#4f86f7';
  ghost.style.color = getContrastColor(slot.color || '#4f86f7');
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;

  dragState = { slot, grabOffsetMin, preview: null };

  // Compute where the slot would land if dropped at the cursor's current position.
  const computePreview = (ev) => {
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!target) return null;

    if (state.view === 'week') {
      const col = target.closest('.week-day-col');
      if (!col) return null;
      const rect = col.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      const rawMin =
        HOUR_START * 60 + Math.round((fraction * (HOUR_END - HOUR_START) * 60) / SNAP_MIN) * SNAP_MIN;
      let startMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - dur, rawMin - grabOffsetMin));
      startMin = Math.round(startMin / SNAP_MIN) * SNAP_MIN;
      return { col, date: col.dataset.date, startMin };
    }

    const cell = target.closest('.agenda-track');
    if (!cell) return null;
    const rect = cell.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    const rawMin =
      HOUR_START * 60 + Math.round((fraction * (HOUR_END - HOUR_START) * 60) / SNAP_MIN) * SNAP_MIN;
    let startMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - dur, rawMin - grabOffsetMin));
    startMin = Math.round(startMin / SNAP_MIN) * SNAP_MIN;
    return { cell, date: cell.dataset.date, startMin };
  };

  // Move the actual slot block to its future position so the user sees the result live.
  const applyPreview = (preview) => {
    if (!slotEl || !preview) return;
    if (state.view === 'week') {
      if (!preview.col) return;
      if (slotEl.parentElement !== preview.col) preview.col.appendChild(slotEl);
      const totalMin = (HOUR_END - HOUR_START) * 60;
      const top = ((preview.startMin - HOUR_START * 60) / totalMin) * 100;
      slotEl.style.top = `${top}%`;
    } else {
      if (!preview.cell) return;
      if (slotEl.parentElement !== preview.cell) preview.cell.appendChild(slotEl);
      const totalMin = (HOUR_END - HOUR_START) * 60;
      const left = ((preview.startMin - HOUR_START * 60) / totalMin) * 100;
      slotEl.style.left = `${left}%`;
    }
  };

  const onMouseMove = (ev) => {
    if (!hasMoved) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      hasMoved = true;
      ghost.classList.remove('hidden');
      if (slotEl) slotEl.classList.add('dragging');
    }

    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (target) {
      const col = target.closest('.week-day-col') || target.closest('.agenda-track');
      if (col) col.classList.add('drop-target');
    }

    const preview = computePreview(ev);
    dragState.preview = preview;
    applyPreview(preview);
  };

  const finishDrag = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    dragState = null;
    cancelDrag = null;
  };

  const onMouseUp = (ev) => {
    // Plain click (no meaningful movement): let the native click event open the slot modal.
    if (!hasMoved) {
      finishDrag();
      return;
    }

    const preview = dragState?.preview ?? computePreview(ev);
    finishDrag();

    if (preview) {
      const slotIdx = state.slots.findIndex((s) => s.id === slot.id);
      if (slotIdx >= 0) {
        const s = state.slots[slotIdx];
        const oldDate = s.date;
        const oldStartMin = timeToMin(s.start);
        const finalDate = preview.date || oldDate;
        const finalStartMin = preview.startMin !== undefined && preview.startMin !== null ? preview.startMin : oldStartMin;

        if (finalDate !== oldDate || Math.abs(finalStartMin - oldStartMin) >= SNAP_MIN) {
          s.date = finalDate;
          s.start = minToTime(finalStartMin);
          s.end = minToTime(finalStartMin + dur);
          saveData();
          showToast('Créneau déplacé');
        }
      }
    }

    // Rebuild the DOM from state, whether or not anything changed, to clear the live preview.
    renderAll();
  };

  cancelDrag = () => {
    const wasMoved = hasMoved;
    finishDrag();
    // Discard the live preview and restore the slot to its original position.
    if (wasMoved) renderAll();
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
