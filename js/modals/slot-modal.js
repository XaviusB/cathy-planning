import { state, saveData } from '../state.js';
import { renderAll } from '../renderer.js';
import { showModal, closeAllModals } from './modal.js';
import { showConfirm } from './confirm.js';
import { uid, escapeHtml, showToast } from '../utils/dom.js';
import { formatDate, timeToMin } from '../utils/date.js';

export let editingSlotId = null;

export function openSlotModal(slotId, defaultDate, defaultStart, defaultEnd, defaultUserIds) {
  editingSlotId = slotId || null;

  const titleEl = document.getElementById('slot-modal-title');
  const deleteBtn = document.getElementById('slot-delete-btn');

  const cbContainer = document.getElementById('slot-users-checkboxes');
  cbContainer.innerHTML = state.users
    .map(
      (u) => `<label>
      <input type="checkbox" value="${u.id}" />
      <span class="slot-user-dot" style="background:${u.color}"></span>
      ${escapeHtml(u.name)}
    </label>`,
    )
    .join('');

  if (slotId) {
    const slot = state.slots.find((s) => s.id === slotId);
    if (!slot) return;
    titleEl.textContent = 'Modifier le créneau';
    deleteBtn.style.display = '';
    document.getElementById('slot-title').value = slot.title || '';
    document.getElementById('slot-date').value = slot.date;
    document.getElementById('slot-start').value = slot.start;
    document.getElementById('slot-end').value = slot.end;
    document.getElementById('slot-color').value = slot.color || '#4f86f7';
    document.getElementById('slot-notes').value = slot.notes || '';
    (slot.userIds || []).forEach((id) => {
      const cb = cbContainer.querySelector(`input[value="${id}"]`);
      if (cb) cb.checked = true;
    });
  } else {
    titleEl.textContent = 'Nouveau créneau';
    deleteBtn.style.display = 'none';
    document.getElementById('slot-title').value = '';
    document.getElementById('slot-date').value = defaultDate || formatDate(state.currentDate);
    document.getElementById('slot-start').value = defaultStart || '08:00';
    document.getElementById('slot-end').value = defaultEnd || '12:00';
    document.getElementById('slot-color').value = '#4f86f7';
    document.getElementById('slot-notes').value = '';
    if (defaultUserIds?.length) {
      defaultUserIds.forEach((id) => {
        const cb = cbContainer.querySelector(`input[value="${id}"]`);
        if (cb) cb.checked = true;
      });
    }
  }

  showModal('slot-modal');
}

export function saveSlot() {
  const title = document.getElementById('slot-title').value.trim();
  const date = document.getElementById('slot-date').value;
  const start = document.getElementById('slot-start').value;
  const end = document.getElementById('slot-end').value;
  const color = document.getElementById('slot-color').value;
  const notes = document.getElementById('slot-notes').value.trim();

  if (!date || !start || !end) {
    showToast('Veuillez remplir la date et les horaires', 'error');
    return;
  }
  if (timeToMin(end) <= timeToMin(start)) {
    showToast("L'heure de fin doit être après l'heure de début", 'error');
    return;
  }

  const userIds = Array.from(
    document.querySelectorAll('#slot-users-checkboxes input:checked'),
  ).map((cb) => cb.value);

  if (editingSlotId) {
    const idx = state.slots.findIndex((s) => s.id === editingSlotId);
    if (idx >= 0) Object.assign(state.slots[idx], { title, date, start, end, color, notes, userIds });
  } else {
    state.slots.push({ id: uid(), title, date, start, end, color, notes, userIds });
  }

  saveData();
  closeAllModals();
  renderAll();
  showToast('Créneau enregistré');
}

export async function deleteSlot() {
  if (!editingSlotId) return;
  const ok = await showConfirm('Supprimer ce créneau ?');
  if (!ok) return;
  state.slots = state.slots.filter((s) => s.id !== editingSlotId);
  saveData();
  closeAllModals();
  renderAll();
  showToast('Créneau supprimé');
}
