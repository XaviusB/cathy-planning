import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { SNAP_MIN, HOUR_START, HOUR_END } from '../constants.js';
import { timeToMin, minToTime } from '../utils/date.js';
import { showToast } from '../utils/dom.js';

export let resizeState = null;
export let cancelResize = null;

/**
 * Resize an existing slot by dragging its top (start time) or bottom (end time) edge.
 * `edge` is either 'top' or 'bottom'.
 */
export function startResize(e, slot, edge) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();

  const slotEl = document.querySelector(`.slot-block[data-slot-id="${slot.id}"]`);
  const col = slotEl?.closest('.week-day-col');
  if (!slotEl || !col) return;

  const totalMin = (HOUR_END - HOUR_START) * 60;
  const origStart = timeToMin(slot.start);
  const origEnd = timeToMin(slot.end);
  let moved = false;

  resizeState = { slot, edge, preview: null };

  const yToSnappedMin = (clientY) => {
    const rect = col.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return HOUR_START * 60 + Math.round((fraction * totalMin) / SNAP_MIN) * SNAP_MIN;
  };

  const applyPreview = (startMin, endMin) => {
    const top = ((startMin - HOUR_START * 60) / totalMin) * 100;
    const height = ((endMin - startMin) / totalMin) * 100;
    slotEl.style.top = `${top}%`;
    slotEl.style.height = `${Math.max(height, 1.2)}%`;
    const timeEl = slotEl.querySelector('.slot-time');
    if (timeEl) timeEl.textContent = `${minToTime(startMin)}–${minToTime(endMin)}`;
  };

  const onMouseMove = (ev) => {
    moved = true;
    slotEl.classList.add('resizing');

    const rawMin = yToSnappedMin(ev.clientY);
    let newStart = origStart;
    let newEnd = origEnd;
    if (edge === 'top') {
      newStart = Math.max(HOUR_START * 60, Math.min(origEnd - SNAP_MIN, rawMin));
    } else {
      newEnd = Math.min(HOUR_END * 60, Math.max(origStart + SNAP_MIN, rawMin));
    }

    resizeState.preview = { start: newStart, end: newEnd };
    applyPreview(newStart, newEnd);
  };

  const finish = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    slotEl.classList.remove('resizing');
    resizeState = null;
    cancelResize = null;
  };

  const onMouseUp = () => {
    const preview = resizeState?.preview;
    finish();

    if (!moved || !preview) return;

    const idx = state.slots.findIndex((s) => s.id === slot.id);
    if (idx >= 0) {
      const s = state.slots[idx];
      if (preview.start !== origStart || preview.end !== origEnd) {
        s.start = minToTime(preview.start);
        s.end = minToTime(preview.end);
        saveData();
        showToast('Créneau redimensionné');
      }
    }

    // Rebuild from state to clear the live preview and reflect the committed change.
    renderAll();
  };

  cancelResize = () => {
    finish();
    if (moved) renderAll();
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
