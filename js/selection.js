import { state, isSlotVisible } from './state.js';

const selectedSlotIds = new Set();

export function selectDay(dateStr) {
  selectedSlotIds.clear();
  state.slots
    .filter((slot) => slot.date === dateStr && isSlotVisible(slot))
    .forEach((slot) => selectedSlotIds.add(slot.id));
  syncSelectionClasses();
}

export function selectSlot(slotId) {
  selectedSlotIds.clear();
  selectedSlotIds.add(slotId);
  syncSelectionClasses();
}

export function toggleSlot(slotId) {
  if (selectedSlotIds.has(slotId)) {
    selectedSlotIds.delete(slotId);
  } else {
    selectedSlotIds.add(slotId);
  }
  syncSelectionClasses();
}

export function clearSelection() {
  if (!selectedSlotIds.size) return;
  selectedSlotIds.clear();
  syncSelectionClasses();
}

export function isSlotSelected(slotId) {
  return selectedSlotIds.has(slotId);
}

export function getSelectedSlotIds() {
  return [...selectedSlotIds];
}

function syncSelectionClasses() {
  document.querySelectorAll('[data-slot-id]').forEach((element) => {
    element.classList.toggle('selected', selectedSlotIds.has(element.dataset.slotId));
  });

  const selectedDates = new Set(
    state.slots
      .filter((slot) => selectedSlotIds.has(slot.id))
      .map((slot) => slot.date),
  );
  document.querySelectorAll('.week-day-header[data-date], .agenda-row[data-date]').forEach((element) => {
    element.classList.toggle('day-selected', selectedDates.has(element.dataset.date));
  });
}
