import { SNAP_MIN, HOUR_START, HOUR_END } from '../constants.js';
import { minToTime } from '../utils/date.js';
import { openSlotModal } from '../modals/slot-modal.js';

export function startGridDraw(e, col) {
  if (e.button !== 0) return;
  if (e.target.closest('.slot-block') || e.target.closest('.current-time-line')) return;
  e.preventDefault();

  const dateStr = col.dataset.date;
  const totalMin = (HOUR_END - HOUR_START) * 60;

  function yToSnappedMin(y) {
    const rect = col.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    const raw = HOUR_START * 60 + Math.round((fraction * totalMin) / SNAP_MIN) * SNAP_MIN;
    return Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - SNAP_MIN, raw));
  }

  const anchorMin = yToSnappedMin(e.clientY);

  const preview = document.createElement('div');
  preview.className = 'grid-selection-preview';
  col.appendChild(preview);

  function updatePreview(curMin) {
    const startMin = Math.min(anchorMin, curMin);
    const endMin = Math.max(anchorMin + SNAP_MIN, curMin);
    const top = ((startMin - HOUR_START * 60) / totalMin) * 100;
    const height = ((endMin - startMin) / totalMin) * 100;
    preview.style.top = `${top}%`;
    preview.style.height = `${Math.max(height, 0.5)}%`;
    preview.dataset.time = `${minToTime(startMin)} – ${minToTime(endMin)}`;
  }

  updatePreview(anchorMin + 60);

  const onMouseMove = (ev) => updatePreview(yToSnappedMin(ev.clientY));

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    preview.remove();

    let endMin = yToSnappedMin(ev.clientY);
    if (endMin <= anchorMin) endMin = anchorMin + 60;
    if (endMin - anchorMin < SNAP_MIN) endMin = anchorMin + SNAP_MIN;

    openSlotModal(null, dateStr, minToTime(anchorMin), minToTime(endMin));
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
