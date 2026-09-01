import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { SNAP_MIN, HOUR_START, HOUR_END } from '../constants.js';
import { minToTime } from '../utils/date.js';
import { getContrastColor, showToast } from '../utils/dom.js';
import { openSlotModal } from '../modals/slot-modal.js';

export function startUserDrag(e, user) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const ghost = document.getElementById('drag-ghost');
  ghost.textContent = user.name;
  ghost.style.background = user.color;
  ghost.style.color = getContrastColor(user.color);
  ghost.classList.remove('hidden');
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;

  const onMouseMove = (ev) => {
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (hit) {
      const slotBlock = hit.closest('.slot-block');
      const col = hit.closest('.week-day-col');
      if (slotBlock) slotBlock.classList.add('drop-target');
      else if (col) col.classList.add('drop-target');
    }
  };

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));

    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!hit) return;

    // Drop on existing slot → directly assign user
    const slotBlock = hit.closest('.slot-block');
    if (slotBlock) {
      const slotId = slotBlock.dataset.slotId;
      const slotIdx = state.slots.findIndex((s) => s.id === slotId);
      if (slotIdx >= 0) {
        const s = state.slots[slotIdx];
        if (!(s.userIds || []).includes(user.id)) {
          s.userIds = [...(s.userIds || []), user.id];
          saveData();
          renderAll();
          showToast(`${user.name} assigné(e)`);
        } else {
          showToast(`${user.name} est déjà assigné(e)`, 'error');
        }
      }
      return;
    }

    // Drop on empty column → open creation modal pre-filled
    const col = hit.closest('.week-day-col');
    if (col && state.view === 'week') {
      const dateStr = col.dataset.date;
      const rect = col.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      const totalMin = (HOUR_END - HOUR_START) * 60;
      const rawStart = HOUR_START * 60 + Math.round((fraction * totalMin) / SNAP_MIN) * SNAP_MIN;
      const startMin = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - 60, rawStart));
      openSlotModal(null, dateStr, minToTime(startMin), minToTime(startMin + 60), [user.id]);
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
