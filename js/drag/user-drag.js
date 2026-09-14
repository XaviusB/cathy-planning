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
    document
      .querySelectorAll('.user-reorder-before, .user-reorder-after')
      .forEach((el) => el.classList.remove('user-reorder-before', 'user-reorder-after'));
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (hit) {
      const userDropTarget = findUserDropTarget(hit, user.id);
      if (userDropTarget) {
        const rect = userDropTarget.element.getBoundingClientRect();
        const positionClass = ev.clientY < rect.top + rect.height / 2
          ? userDropTarget.beforeClass
          : userDropTarget.afterClass;
        userDropTarget.element.classList.add(positionClass);
      } else {
        const slotBlock = hit.closest('.slot-block');
        const col = hit.closest('.week-day-col');
        if (slotBlock) slotBlock.classList.add('drop-target');
        else if (col) col.classList.add('drop-target');
      }
    }
  };

  const onMouseUp = (ev) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    document
      .querySelectorAll('.user-reorder-before, .user-reorder-after')
      .forEach((el) => el.classList.remove('user-reorder-before', 'user-reorder-after'));

    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!hit) return;

    const userDropTarget = findUserDropTarget(hit, user.id);
    if (userDropTarget) {
      reorderUser(user.id, userDropTarget.element.dataset.userId, ev.clientY, userDropTarget.element);
      return;
    }

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

function findUserDropTarget(element, draggedUserId) {
  const userCard = element.closest('.user-card');
  if (userCard && userCard.dataset.userId !== draggedUserId) {
    return {
      element: userCard,
      beforeClass: 'user-reorder-before',
      afterClass: 'user-reorder-after',
    };
  }

  const userRow = element.closest('.dashboard-table tbody tr');
  if (userRow && userRow.dataset.userId !== draggedUserId) {
    return {
      element: userRow,
      beforeClass: 'user-reorder-before',
      afterClass: 'user-reorder-after',
    };
  }

  return null;
}

function reorderUser(userId, targetUserId, clientY, targetElement) {
  const fromIndex = state.users.findIndex((item) => item.id === userId);
  const targetIndex = state.users.findIndex((item) => item.id === targetUserId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;

  const [user] = state.users.splice(fromIndex, 1);
  const adjustedTargetIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
  const targetRect = targetElement.getBoundingClientRect();
  const insertIndex = clientY < targetRect.top + targetRect.height / 2
    ? adjustedTargetIndex
    : adjustedTargetIndex + 1;

  state.users.splice(insertIndex, 0, user);
  saveData();
  renderAll();
  showToast('Ordre des utilisateurs mis à jour');
}
