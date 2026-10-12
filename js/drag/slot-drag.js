import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { SNAP_MIN, HOUR_START, HOUR_END } from '../constants.js';
import { addDays, formatDate, parseDate, slotDurationMin, timeToMin, minToTime } from '../utils/date.js';
import { getContrastColor, showToast } from '../utils/dom.js';
import { getSelectedSlotIds, isSlotSelected, selectSlot } from '../selection.js';

const MONTH_EDGE_SCROLL_THRESHOLD = 64;
const MONTH_EDGE_SCROLL_MAX_SPEED = 12;

export let dragState = null;
export let cancelDrag = null;

export function startDrag(e, slot) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();

  const dur = slotDurationMin(slot);
  let grabOffsetMin = 0;
  const slotEl = e.currentTarget;
  if (!isSlotSelected(slot.id)) selectSlot(slot.id);
  const draggedSlotIds = getSelectedSlotIds();
  const activeSlotSelector = state.view === 'week'
    ? '#week-view .slot-block'
    : '#month-view .agenda-slot-pill';
  const draggedItems = draggedSlotIds
    .map((slotId) => state.slots.find((item) => item.id === slotId))
    .filter(Boolean)
    .map((draggedSlot) => ({
      slot: draggedSlot,
      element: [...document.querySelectorAll(activeSlotSelector)]
        .find((element) => element.dataset.slotId === draggedSlot.id),
      duration: slotDurationMin(draggedSlot),
      startMin: timeToMin(draggedSlot.start),
      dateOffset: Math.round(
        (parseDate(draggedSlot.date).getTime() - parseDate(slot.date).getTime()) / (24 * 60 * 60 * 1000),
      ),
    }));
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
  let monthAutoScrollFrame = null;
  let latestPointer = null;

  const ghost = document.getElementById('drag-ghost');
  ghost.textContent = slot.title || 'Créneau';
  ghost.style.background = slot.color || '#4f86f7';
  ghost.style.color = getContrastColor(slot.color || '#4f86f7');
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;

  dragState = { slot, slotIds: draggedSlotIds, grabOffsetMin, preview: null };

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

  const calculateGroupMove = (preview) => {
    if (!preview?.date || preview.startMin === undefined) return null;

    let timeDelta = preview.startMin - timeToMin(slot.start);
    let minDelta = -Infinity;
    let maxDelta = Infinity;
    draggedItems.forEach((item) => {
      minDelta = Math.max(minDelta, HOUR_START * 60 - item.startMin);
      maxDelta = Math.min(maxDelta, HOUR_END * 60 - item.duration - item.startMin);
    });
    timeDelta = Math.max(minDelta, Math.min(maxDelta, timeDelta));
    return { date: preview.date, timeDelta };
  };

  const findDropTarget = (dateStr) => {
    const targets = document.querySelectorAll(
      state.view === 'week' ? '#week-view .week-day-col' : '#month-view .agenda-track',
    );
    return [...targets].find((target) => target.dataset.date === dateStr);
  };

  // Move every selected slot live while preserving each slot's relative offset.
  const applyPreview = (preview) => {
    const groupMove = calculateGroupMove(preview);
    if (!groupMove) return;

    draggedItems.forEach((item) => {
      const targetDate = formatDate(addDays(parseDate(groupMove.date), item.dateOffset));
      const target = findDropTarget(targetDate);
      if (!target || !item.element) return;
      if (item.element.parentElement !== target) target.appendChild(item.element);

      const startMin = item.startMin + groupMove.timeDelta;
      const totalMin = (HOUR_END - HOUR_START) * 60;
      if (state.view === 'week') {
        item.element.style.top = `${((startMin - HOUR_START * 60) / totalMin) * 100}%`;
      } else {
        item.element.style.left = `${((startMin - HOUR_START * 60) / totalMin) * 100}%`;
      }
    });
  };

  const stopMonthAutoScroll = () => {
    if (monthAutoScrollFrame !== null) {
      cancelAnimationFrame(monthAutoScrollFrame);
      monthAutoScrollFrame = null;
    }
  };

  const getMonthScrollDelta = () => {
    if (state.view !== 'month' || !latestPointer) return 0;
    const monthView = document.getElementById('month-view');
    if (!monthView) return 0;

    const rect = monthView.getBoundingClientRect();
    const distanceFromTop = latestPointer.clientY - rect.top;
    const distanceFromBottom = rect.bottom - latestPointer.clientY;
    if (distanceFromTop < MONTH_EDGE_SCROLL_THRESHOLD && monthView.scrollTop > 0) {
      return -Math.min(
        MONTH_EDGE_SCROLL_MAX_SPEED,
        Math.max(1, MONTH_EDGE_SCROLL_THRESHOLD - distanceFromTop),
      );
    }
    if (
      distanceFromBottom < MONTH_EDGE_SCROLL_THRESHOLD &&
      monthView.scrollTop < monthView.scrollHeight - monthView.clientHeight
    ) {
      return Math.min(
        MONTH_EDGE_SCROLL_MAX_SPEED,
        Math.max(1, MONTH_EDGE_SCROLL_THRESHOLD - distanceFromBottom),
      );
    }
    return 0;
  };

  const autoScrollMonth = () => {
    monthAutoScrollFrame = null;
    if (!hasMoved) return;

    const delta = getMonthScrollDelta();
    if (!delta) return;

    const monthView = document.getElementById('month-view');
    monthView.scrollTop += delta;
    const preview = computePreview(latestPointer);
    dragState.preview = preview;
    applyPreview(preview);
    monthAutoScrollFrame = requestAnimationFrame(autoScrollMonth);
  };

  const scheduleMonthAutoScroll = (ev) => {
    latestPointer = ev;
    if (monthAutoScrollFrame === null && getMonthScrollDelta() !== 0) {
      monthAutoScrollFrame = requestAnimationFrame(autoScrollMonth);
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
    scheduleMonthAutoScroll(ev);
  };

  const finishDrag = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    stopMonthAutoScroll();
    ghost.classList.add('hidden');
    document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    dragState = null;
    cancelDrag = null;
  };

  const onMouseUp = (ev) => {
    // Plain click selects only this slot; the double-click handler opens its modal.
    if (!hasMoved) {
      selectSlot(slot.id);
      finishDrag();
      return;
    }

    const preview = dragState?.preview ?? computePreview(ev);
    finishDrag();

    const groupMove = calculateGroupMove(preview);
    if (groupMove) {
      const movedSlots = draggedItems
        .map((item) => {
          const current = state.slots.find((stateSlot) => stateSlot.id === item.slot.id);
          if (!current) return null;
          const finalDate = formatDate(addDays(parseDate(groupMove.date), item.dateOffset));
          const finalStartMin = item.startMin + groupMove.timeDelta;
          const changed = current.date !== finalDate || timeToMin(current.start) !== finalStartMin;
          current.date = finalDate;
          current.start = minToTime(finalStartMin);
          current.end = minToTime(finalStartMin + item.duration);
          return changed ? current : null;
        })
        .filter(Boolean);

      if (movedSlots.length) {
        saveData();
        showToast(`${movedSlots.length} créneau(x) déplacé(s)`);
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
