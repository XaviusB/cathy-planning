import { SNAP_MIN, HOUR_START, HOUR_END } from '../constants.js';
import { minToTime } from '../utils/date.js';
import { openSlotModal } from '../modals/slot-modal.js';

export function startGridDraw(e, container) {
  if (e.button !== 0) return;
  if (e.target.closest('.slot-block') || e.target.closest('.agenda-slot-pill') || e.target.closest('.current-time-line')) return;
  e.preventDefault();

  const horizontal = container.classList.contains('agenda-track');
  const dateStr = container.dataset.date;
  const totalMin = (HOUR_END - HOUR_START) * 60;

  function posToSnappedMin(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const fraction = horizontal
      ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      : Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const raw = HOUR_START * 60 + Math.round((fraction * totalMin) / SNAP_MIN) * SNAP_MIN;
    return Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - SNAP_MIN, raw));
  }

  const anchorMin = posToSnappedMin(e.clientX, e.clientY);

  const preview = document.createElement('div');
  preview.className = horizontal ? 'grid-selection-preview horizontal' : 'grid-selection-preview';
  container.appendChild(preview);

  function updatePreview(curMin) {
    const startMin = Math.min(anchorMin, curMin);
    const endMin = Math.max(anchorMin + SNAP_MIN, curMin);
    if (horizontal) {
      const left = ((startMin - HOUR_START * 60) / totalMin) * 100;
      const width = ((endMin - startMin) / totalMin) * 100;
      preview.style.left = `${left}%`;
      preview.style.width = `${Math.max(width, 0.5)}%`;
    } else {
      const top = ((startMin - HOUR_START * 60) / totalMin) * 100;
      const height = ((endMin - startMin) / totalMin) * 100;
      preview.style.top = `${top}%`;
      preview.style.height = `${Math.max(height, 0.5)}%`;
    }
    preview.dataset.time = `${minToTime(startMin)} – ${minToTime(endMin)}`;
  }

  updatePreview(anchorMin + 60);

  const onMouseMove = (ev) => updatePreview(posToSnappedMin(ev.clientX, ev.clientY));

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    preview.remove();

    let endMin = posToSnappedMin(ev.clientX, ev.clientY);
    if (endMin <= anchorMin) endMin = anchorMin + 60;
    if (endMin - anchorMin < SNAP_MIN) endMin = anchorMin + SNAP_MIN;

    openSlotModal(null, dateStr, minToTime(anchorMin), minToTime(endMin));
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
